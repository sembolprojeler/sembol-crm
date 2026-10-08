// src/WhatsApp.jsx
// ============================================================================
// CRM — WHATSAPP PANELİ (Satış → WhatsApp)
// ----------------------------------------------------------------------------
// Solda konuşma listesi, sağda sohbet. Veriler Firestore dinleyicisiyle canlı gelir
// (okuma kurallarda zaten açık); YAZMA yalnızca sunucudan: /api/whatsapp-send
// (gonder / devral / botaVer / okundu — personelId + şifre ile, api/_lib/crmYetki.js).
// Mantık (24 saat penceresi, sıralama, etiketler, sekme başlığı) → src/whatsappPanel.js.
// Medya (2026-10-07): crm/uploads'taki dosya — görsel önizleme (tıklayınca büyük: setViewingImage), ses / video
// oynatıcı, belgede "İndir"; "yükleniyor" / "medya alınamadı"; eski mesajda "Medyayı getir" (/api/whatsapp-send medyaGetir).
// Konum harita linkiyle.
// "kaynak" prop'u test/önizleme içindir; varsayılan src/whatsappKaynak.js (Firestore + /api/whatsapp-send).
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, Bot, UserCheck, Search, ExternalLink, MapPin, AlertTriangle, ArrowLeft, Lock, Loader2, X, Download, FileText, RefreshCw,
  CalendarDays, Phone, Briefcase, Eye, Users } from 'lucide-react'; // YENİ (2026-10-08): havuz listesi simgeleri
import { firestoreKaynagi } from './whatsappKaynak.js';
import { pencereAcikMi, pencereKalan, konusmalariSuz, mesajGorunumu, medyaGorunumu, boyutMetni, gorselGoruntuleyiciIstegi, durumBilgisi, dikkatSayisi, sekmeBasligi, bekliyorMu,
  listeSaati, konusmaMarkasi, MARKA_ETIKETI, PENCERE_UYARISI, SIFRE_YOK_MESAJI } from './whatsappPanel.js';

const MARKA_RENK = { depoevim: 'bg-blue-50 text-blue-700 border-blue-200', sembol: 'bg-red-50 text-red-700 border-red-200' };
const mesajSaati = (iso, simdi) => {
  const t = new Date(iso || '');
  if (Number.isNaN(t.getTime())) return '';
  const saat = t.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
  const gun = listeSaati(iso, simdi);
  return gun.includes(':') ? saat : `${gun} ${saat}`;
};

// Mesaj balonundaki medya: önizleme / oynatıcı / indir; durum ve "Medyayı getir"
const MedyaIcerik = ({ md, metin, onGorselAc, onGetir, getiriliyor }) => {
  const indir = md.url && (
    <a href={md.url} target="_blank" rel="noopener noreferrer" download className="text-[11px] font-black text-blue-700 underline inline-flex items-center gap-0.5">
      <Download className="w-3 h-3" /> İndir{md.boyut ? ` (${boyutMetni(md.boyut)})` : ''}
    </a>);
  let govde;
  if (md.durum === 'hazir') {
    if (md.tur === 'gorsel') govde = (
      <button type="button" onClick={() => onGorselAc?.(gorselGoruntuleyiciIstegi(md))} className="block" title="Büyüt">
        <img src={md.url} alt={md.caption || 'Görsel'} loading="lazy" className="max-h-48 max-w-full rounded-lg object-cover" />
      </button>);
    else if (md.tur === 'ses') govde = (<div className="space-y-0.5"><audio controls preload="none" src={md.url} className="w-60 max-w-full" />{indir}</div>);
    else if (md.tur === 'video') govde = (<div className="space-y-0.5"><video controls preload="metadata" src={md.url} className="max-h-60 max-w-full rounded-lg" />{indir}</div>);
    else govde = (
      <div className="flex items-center gap-2 p-2 rounded-lg bg-black/5">
        <FileText className="w-6 h-6 text-neutral-500 shrink-0" />
        <div className="min-w-0"><p className="text-[12px] font-bold truncate">{md.dosyaAdi || 'Belge'}</p>{indir}</div>
      </div>);
  } else {
    govde = (
      <div className="text-[12px] italic text-neutral-600">
        <p className="whitespace-pre-wrap break-words">{metin}</p>
        {md.durum === 'bekliyor' && !md.getirilebilir && <p className="text-[11px] not-italic font-bold text-neutral-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Medya yükleniyor…</p>}
        {md.suresiDoldu && <p className="text-[11px] not-italic font-bold text-neutral-500">Medya artık alınamıyor</p>}
        {md.durum === 'hata' && !md.suresiDoldu && <p className="text-[11px] not-italic font-bold text-red-600" title={md.hata}>Medya alınamadı</p>}
        {md.getirilebilir && onGetir && (
          <button type="button" disabled={getiriliyor} onClick={onGetir}
            className="mt-1 not-italic px-2 py-1 rounded-lg text-[11px] font-black bg-white border border-neutral-300 hover:bg-neutral-50 inline-flex items-center gap-1 disabled:opacity-50">
            {getiriliyor ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Medyayı getir
          </button>)}
      </div>);
  }
  return (<div className="space-y-1">{govde}{md.caption && <p className="text-[13px] whitespace-pre-wrap break-words text-neutral-900">{md.caption}</p>}</div>);
};

const ModRozeti = ({ k }) => (k.mode === 'human'
  ? <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300"><UserCheck className="w-3 h-3" /> Personel</span>
  : <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200"><Bot className="w-3 h-3" /> Bot</span>);

export const WhatsAppView = ({ currentUser, yonetici = false, acIstegi = null, onLeadAc, onGorselAc, kaynak = firestoreKaynagi, simdi = () => Date.now() }) => {
  const [konusmalar, setKonusmalar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [okumaHatasi, setOkumaHatasi] = useState('');
  const [seciliId, setSeciliId] = useState(null);
  const [islenenIstek, setIslenenIstek] = useState(null);
  const [filtre, setFiltre] = useState({ marka: 'tumu', mod: 'tumu', arama: '' });
  const [durum, setDurum] = useState({});
  // DEĞİŞTİ (2026-10-08): sohbet bölümü (mesajlar, yazma, devral / bota ver) WhatsAppSohbet
  // bileşenine taşındı — Müşteri Havuzu'ndaki "WhatsApp Mesajları Havuzu" da aynısını kullanır.

  useEffect(() => kaynak.konusmalariDinle(
    (l) => { setKonusmalar(l); setYukleniyor(false); setOkumaHatasi(''); },
    () => { setYukleniyor(false); setOkumaHatasi('Konuşmalar okunamadı. Sayfayı yenileyin.'); }), [kaynak]);
  useEffect(() => kaynak.durumDinle(setDurum), [kaynak]);

  const sec = (kid) => { setSeciliId(kid); };
  // Lead ekranından gelen "sohbeti aç" isteği — her yeni istek (no) bir kez uygulanır
  if (acIstegi?.konusmaId && acIstegi.no !== islenenIstek) { setIslenenIstek(acIstegi.no); sec(acIstegi.konusmaId); }

  // Sekme başlığı: "(2) WhatsApp – CRM" — panelden çıkınca eski başlık geri gelir
  const ilkBaslik = useRef(typeof document !== 'undefined' ? document.title : '');
  const dikkat = dikkatSayisi(konusmalar);
  useEffect(() => { document.title = sekmeBasligi(dikkat); }, [dikkat]);
  useEffect(() => () => { document.title = ilkBaslik.current; }, []);

  const secili = konusmalar.find(k => k.id === seciliId) || null;
  const liste = useMemo(() => konusmalariSuz(konusmalar, filtre), [konusmalar, filtre]);
  const uyarilar = ['token', 'ai'].map(a => durum[a]).filter(d => d?.aktif);

  return (
    <div className="animate-in fade-in">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-xl md:text-2xl font-black text-black flex items-center gap-2"><MessageCircle className="w-6 h-6 text-green-600" /> WhatsApp</h2>
        <span className="text-[11px] font-bold text-neutral-500">{konusmalar.length} konuşma · {konusmalar.filter(bekliyorMu).length} personel bekliyor</span>
      </div>
      {uyarilar.map((u, i) => (
        <div key={i} className="mb-3 p-3 rounded-xl border-2 border-red-300 bg-red-50 text-red-800 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {u.mesaj}
        </div>
      ))}

      <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden flex h-[calc(100vh-190px)] min-h-[480px]">
        {/* ------------------------------------------------ KONUŞMA LİSTESİ */}
        <div className={`${secili ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-[340px] md:border-r border-neutral-200 shrink-0`}>
          <div className="p-3 border-b border-neutral-200 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={filtre.arama} onChange={e => setFiltre(f => ({ ...f, arama: e.target.value }))} placeholder="İsim ya da numara ara"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-100 text-sm font-bold outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[['tumu', 'Tümü'], ['bekleyen', 'Personel bekliyor'], ['bot', 'Bot'], ['human', 'Personel']].map(([id, ad]) => (
                <button key={id} type="button" onClick={() => setFiltre(f => ({ ...f, mod: id }))}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition ${filtre.mod === id ? 'bg-black text-white border-black' : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'}`}>{ad}</button>
              ))}
              <select value={filtre.marka} onChange={e => setFiltre(f => ({ ...f, marka: e.target.value }))}
                className="ml-auto px-2 py-1 rounded-lg text-[11px] font-black border border-neutral-200 bg-white">
                <option value="tumu">Tüm hatlar</option><option value="depoevim">DepoEvim</option><option value="sembol">Sembol</option>
              </select>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {yukleniyor && <p className="p-6 text-center text-sm font-bold text-neutral-400"><Loader2 className="w-4 h-4 inline animate-spin mr-1" /> Yükleniyor…</p>}
            {okumaHatasi && <p className="p-6 text-center text-sm font-bold text-red-600">{okumaHatasi}</p>}
            {!yukleniyor && !okumaHatasi && liste.length === 0 && <p className="p-6 text-center text-sm font-bold text-neutral-400">Konuşma yok.</p>}
            {liste.map(k => {
              const okunmamis = Number(k.unreadCount) || 0;
              const marka = konusmaMarkasi(k);
              return (
                <button key={k.id} type="button" onClick={() => sec(k.id)}
                  className={`w-full text-left px-3 py-2.5 border-b border-neutral-100 transition flex gap-2.5 ${k.id === seciliId ? 'bg-green-50' : 'hover:bg-neutral-50'}`}>
                  <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-black shrink-0">
                    {(k.profileName || '?').trim().charAt(0).toLocaleUpperCase('tr-TR') || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`truncate text-[13px] ${okunmamis ? 'font-black text-black' : 'font-bold text-neutral-800'}`}>{k.profileName || k.phone || 'WhatsApp Müşterisi'}</span>
                      <span className="ml-auto text-[10px] font-bold text-neutral-400 shrink-0">{listeSaati(k.lastMessageAt, simdi())}</span>
                    </div>
                    <p className={`text-[12px] truncate ${okunmamis ? 'text-neutral-800 font-bold' : 'text-neutral-500'}`}>{k.lastMessagePreview || '—'}</p>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {bekliyorMu(k) && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-red-600 text-white">Personel bekliyor</span>}
                      <ModRozeti k={k} />
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${MARKA_RENK[marka]}`}>{MARKA_ETIKETI[marka]}</span>
                      {okunmamis > 0 && <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-green-600 text-white text-[10px] font-black flex items-center justify-center">{okunmamis}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ------------------------------------------------ SOHBET */}
        <div className={`${secili ? 'flex' : 'hidden md:flex'} flex-col flex-1 min-w-0`}>
          {!secili ? (
            <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 p-6 text-center">
              <MessageCircle className="w-12 h-12 mb-2" />
              <p className="font-bold text-sm">Soldan bir konuşma seçin.</p>
            </div>
          ) : (
            /* DEĞİŞTİ (2026-10-08): sohbet bölümü ortak bileşen — key ile her konuşmada sıfırdan açılır */
            <WhatsAppSohbet key={secili.id} konusma={secili} currentUser={currentUser} yonetici={yonetici}
              onGeri={() => sec(null)} onLeadAc={onLeadAc} onGorselAc={onGorselAc} kaynak={kaynak} simdi={simdi} />
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// YENİ (2026-10-08): WHATSAPP SOHBET — tek konuşmanın sohbet bölümü (ortak bileşen)
// ----------------------------------------------------------------------------
// WhatsApp panelinin sağ tarafı ile Müşteri Havuzu › "WhatsApp Mesajları Havuzu"
// penceresi AYNI bileşeni kullanır: mesajlar, medya, devral / bota geri ver,
// 24 saat penceresi, okundu bildirimi. Davranış eskisiyle birebir aynıdır.
// konusma: canlı konuşma kaydı · onGeri: geri / kapat düğmesi (geriHerZaman: masaüstünde de göster)
// ============================================================================
export const WhatsAppSohbet = ({ konusma, currentUser, yonetici = false, onGeri = null, geriHerZaman = false,
  onLeadAc, onGorselAc, kaynak = firestoreKaynagi, simdi = () => Date.now() }) => {
  const secili = konusma;
  const [mesajlar, setMesajlar] = useState([]);
  const [metin, setMetin] = useState('');
  const [isleniyor, setIsleniyor] = useState('');
  const [hata, setHata] = useState('');
  const sonRef = useRef(null);
  const okunduIstendi = useRef('');
  const kimlik = { personelId: currentUser?.id, sifre: currentUser?.password };

  useEffect(() => {
    if (!secili?.id) return undefined;
    return kaynak.mesajlariDinle(secili.id, (liste) => setMesajlar(liste), () => setHata('Mesajlar okunamadı.'));
  }, [secili?.id, kaynak]);
  useEffect(() => { sonRef.current?.scrollIntoView?.({ block: 'end' }); }, [mesajlar.length, secili?.id]);

  // Açık sohbette okunmamış varsa sunucuya "okundu" (her artışta bir kez)
  useEffect(() => {
    if (!secili || !(Number(secili.unreadCount) > 0) || !currentUser?.password) return;
    const anahtar = `${secili.id}:${secili.lastCustomerWamid || secili.unreadCount}`;
    if (okunduIstendi.current === anahtar) return;
    okunduIstendi.current = anahtar;
    kaynak.istek({ islem: 'okundu', konusmaId: secili.id, ...kimlik });
  }, [secili?.id, secili?.unreadCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const islemYap = async (islem, ek = {}) => {
    if (!currentUser?.password) { setHata(SIFRE_YOK_MESAJI); return false; }
    setIsleniyor(islem === 'medyaGetir' ? `medya:${ek.mesajId}` : islem); setHata('');
    const r = await kaynak.istek({ islem, konusmaId: secili.id, ...kimlik, ...ek });
    setIsleniyor('');
    if (!r.ok) { if (!(islem === 'medyaGetir' && r.durum === 410)) setHata(r.hata || 'İşlem yapılamadı.'); return false; }
    return true;
  };
  const gonder = async () => {
    const m = metin.trim();
    if (!m || !secili || isleniyor) return;
    if (await islemYap('gonder', { metin: m })) setMetin('');
  };

  if (!secili) return null;
  const acik = pencereAcikMi(secili, simdi());
  const devralanBen = secili?.devralan?.id && String(secili.devralan.id) === String(currentUser?.id);
  const botaVerebilir = secili?.mode === 'human' && (!secili?.devralan?.id || devralanBen || yonetici);

  return (<>
            <div className="px-3 py-2.5 border-b border-neutral-200 flex items-center gap-2 flex-wrap">
              {onGeri && <button type="button" onClick={onGeri} className={`${geriHerZaman ? '' : 'md:hidden '}p-1.5 rounded-lg hover:bg-neutral-100`} title="Geri"><ArrowLeft className="w-5 h-5" /></button>}
              <div className="min-w-0">
                <p className="font-black text-black text-sm truncate">{secili.profileName || 'WhatsApp Müşterisi'}</p>
                <p className="text-[11px] font-bold text-neutral-500">{secili.phone || secili.waId}</p>
              </div>
              <ModRozeti k={secili} />
              {secili.mode === 'human' && secili.devralan?.ad && <span className="text-[10px] font-bold text-amber-800">· {secili.devralan.ad}</span>}
              <div className="ml-auto flex items-center gap-1.5 flex-wrap justify-end">
                {secili.leadId && onLeadAc && (
                  <button type="button" onClick={() => onLeadAc(secili.leadId)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-black border border-neutral-200 hover:bg-neutral-50 flex items-center gap-1">
                    <ExternalLink className="w-3.5 h-3.5" /> Lead
                  </button>)}
                {secili.tasimaLeadId && onLeadAc && (
                  <button type="button" onClick={() => onLeadAc(secili.tasimaLeadId)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-black border border-red-200 text-red-700 hover:bg-red-50 flex items-center gap-1">
                    <ExternalLink className="w-3.5 h-3.5" /> Taşıma lead'i
                  </button>)}
                {(secili.mode !== 'human' || !devralanBen) && (
                  <button type="button" disabled={!!isleniyor} onClick={() => islemYap('devral')}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-black bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1 disabled:opacity-50">
                    <UserCheck className="w-3.5 h-3.5" /> Devral
                  </button>)}
                {secili.mode === 'human' && (
                  <button type="button" disabled={!!isleniyor || !botaVerebilir} onClick={() => islemYap('botaVer')}
                    title={botaVerebilir ? '' : `Bu konuşmayı ${secili.devralan?.ad || 'başka bir personel'} devraldı; bota yalnızca o ya da bir yönetici geri verebilir.`}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-black bg-neutral-800 hover:bg-black text-white flex items-center gap-1 disabled:opacity-40">
                    <Bot className="w-3.5 h-3.5" /> Bota geri ver
                  </button>)}
              </div>
            </div>
            {bekliyorMu(secili) && (
              <div className="px-3 py-1.5 bg-red-50 border-b border-red-200 text-[11px] font-bold text-red-800">
                Personel bekliyor{secili.handoffReason ? `: ${secili.handoffReason}` : ''}
              </div>
            )}

            <div className="flex-1 overflow-y-auto bg-[#efeae2] px-3 py-3 space-y-1.5">
              {mesajlar.map(m => {
                const g = mesajGorunumu(m);
                const md = medyaGorunumu(m, simdi());
                const d = durumBilgisi(m);
                const sag = g.kimden !== 'musteri';
                const renk = g.kimden === 'musteri' ? 'bg-white' : g.kimden === 'personel' ? 'bg-[#d9fdd3]' : 'bg-sky-50 border border-sky-100';
                return (
                  <div key={m.id} className={`flex ${sag ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-2.5 py-1.5 shadow-sm ${renk}`}>
                      {g.ad && <p className={`text-[10px] font-black mb-0.5 ${g.kimden === 'personel' ? 'text-green-700' : 'text-sky-700'}`}>
                        {g.kimden === 'bot' && <Bot className="w-3 h-3 inline mr-0.5 -mt-0.5" />}{g.ad}{g.otomatik ? ' · otomatik' : ''}</p>}
                      {md ? <MedyaIcerik md={md} metin={g.metin} onGorselAc={onGorselAc} getiriliyor={isleniyor === `medya:${m.id}`}
                          onGetir={() => islemYap('medyaGetir', { mesajId: m.id })} />
                        : <p className={`text-[13px] whitespace-pre-wrap break-words ${g.medya ? 'italic text-neutral-600' : 'text-neutral-900'}`}>{g.metin}</p>}
                      {g.harita && <a href={g.harita} target="_blank" rel="noopener noreferrer" className="text-[11px] font-black text-blue-700 underline inline-flex items-center gap-0.5"><MapPin className="w-3 h-3" /> Haritada aç</a>}
                      <p className="text-[10px] text-neutral-400 text-right mt-0.5 flex items-center justify-end gap-1">
                        {mesajSaati(m.timestamp, simdi())}
                        {d && <span className={`font-black ${d.renk}`} title={d.baslik}>{d.simge}</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={sonRef} />
            </div>

            {hata && (
              <div className="px-3 py-2 bg-red-50 border-t border-red-200 text-xs font-bold text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> <span className="flex-1">{hata}</span>
                <button type="button" onClick={() => setHata('')}><X className="w-4 h-4" /></button>
              </div>
            )}
            {acik ? (
              <div className="p-2.5 border-t border-neutral-200 flex items-end gap-2">
                <textarea value={metin} onChange={e => setMetin(e.target.value)} rows={2} maxLength={4096}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); gonder(); } }}
                  placeholder={secili.mode === 'human' ? 'Mesaj yazın…' : 'Mesaj yazın… (gönderince konuşmayı devralırsınız, bot susar)'}
                  className="flex-1 resize-none px-3 py-2 rounded-xl bg-neutral-100 text-sm outline-none focus:ring-2 focus:ring-green-500" />
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[9px] font-bold text-neutral-400">{pencereKalan(secili, simdi())} kaldı</span>
                  <button type="button" onClick={gonder} disabled={!metin.trim() || !!isleniyor}
                    className="w-11 h-11 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center disabled:opacity-40">
                    {isleniyor === 'gonder' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 border-t border-neutral-200 bg-neutral-50 text-xs font-bold text-neutral-600 flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0" /> {PENCERE_UYARISI}
              </div>
            )}
  </>);
};

// ============================================================================
// YENİ (2026-10-08): WHATSAPP MESAJLARI HAVUZU — Müşteri Havuzu içinde liste görünümü
// ----------------------------------------------------------------------------
// "Hızlı Teklifler Havuzu" düzeninde: konuşmalar SON MESAJ tarihine göre (yeniden
// eskiye) GÜN BLOKLARINA ayrılır ("8 Ekim 2026 Mesajları · Bugün"). Her satırda
// müşteri, telefon, son mesaj, bot / personel durumu ve hat (Sembol / DepoEvim).
//   • Satıra ya da "Sohbeti Aç"a tıklayınca sohbet AYNI SAYFADA pencerede açılır
//     (WhatsAppSohbet — panelle birebir aynı: yaz, devral, bota geri ver, medya).
//   • "Portföye Ekle" → müşteri "Benim Müşterilerim"e WHATSAPP TEKLİF etiketiyle
//     eklenir (Satis.jsx onPortfoyeEkle). Eklenmişse "Portföyde · Satışçı" görünür.
// Veri kaynağı WhatsApp paneliyle aynıdır (salt okuma; yazma yalnızca sunucudan).
// ============================================================================
const istGunu = (iso) => {
  const t = new Date(iso || '');
  return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }); // 'YYYY-AA-GG'
};
const gunBasligi = (gun) => {
  if (!gun) return 'Tarihsiz';
  const [y, a, g] = gun.split('-').map(Number);
  return new Date(y, a - 1, g).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
};
const gunFarki = (gun, simdiMs) => {
  if (!gun) return null;
  const bugun = istGunu(new Date(simdiMs).toISOString());
  return Math.round((new Date(bugun + 'T00:00:00') - new Date(gun + 'T00:00:00')) / 86400000);
};
const HAVUZ_ZAMANLAR = [['bugun', 'Bugün', 0], ['hafta', 'Son 7 Gün', 6], ['ay', 'Son 30 Gün', 29], ['tumu', 'Tüm Zamanlar', null]];

export const WhatsAppHavuzu = ({ currentUser, yonetici = false, onLeadAc, onGorselAc,
  portfoyHaritasi = {}, onPortfoyeEkle, onPortfoyAc, kaynak = firestoreKaynagi, simdi = () => Date.now() }) => {
  const [konusmalar, setKonusmalar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [okumaHatasi, setOkumaHatasi] = useState('');
  const [filtre, setFiltre] = useState({ marka: 'tumu', mod: 'tumu', arama: '' });
  const [zaman, setZaman] = useState('tumu');
  const [portfoy, setPortfoy] = useState('tumu'); // 'tumu' | 'yok' (portföyde olmayanlar) | 'var'
  const [acikId, setAcikId] = useState(null);
  const [ekleniyor, setEkleniyor] = useState('');

  useEffect(() => kaynak.konusmalariDinle(
    (l) => { setKonusmalar(l); setYukleniyor(false); setOkumaHatasi(''); },
    () => { setYukleniyor(false); setOkumaHatasi('Konuşmalar okunamadı. Sayfayı yenileyin.'); }), [kaynak]);

  const simdiMs = simdi();
  // Filtre (panelle aynı fonksiyon) + zaman + portföy, son mesaja göre yeniden eskiye
  const liste = useMemo(() => {
    const z = HAVUZ_ZAMANLAR.find(x => x[0] === zaman);
    return konusmalariSuz(konusmalar, filtre)
      .filter(k => { if (z?.[2] == null) return true; const f = gunFarki(istGunu(k.lastMessageAt), simdiMs); return f != null && f <= z[2]; })
      .filter(k => portfoy === 'tumu' ? true : portfoy === 'var' ? !!portfoyHaritasi[k.id] : !portfoyHaritasi[k.id])
      .slice().sort((a, b) => String(b.lastMessageAt || '').localeCompare(String(a.lastMessageAt || '')));
  }, [konusmalar, filtre, zaman, portfoy, portfoyHaritasi]); // eslint-disable-line react-hooks/exhaustive-deps
  // Gün blokları
  const bloklar = useMemo(() => {
    const m = new Map();
    liste.forEach(k => { const g = istGunu(k.lastMessageAt); if (!m.has(g)) m.set(g, []); m.get(g).push(k); });
    return [...m.entries()];
  }, [liste]);
  const acik = konusmalar.find(k => k.id === acikId) || null;
  const sayac = (fn) => konusmalar.filter(fn).length;

  const portfoyeEkle = async (k) => {
    if (!onPortfoyeEkle || ekleniyor) return;
    setEkleniyor(k.id);
    try { await onPortfoyeEkle({ ...k, _marka: konusmaMarkasi(k) }); } finally { setEkleniyor(''); } // hat bilgisi (DepoEvim → Depo) ile
  };

  const Cip = ({ aktif, onClick, children }) => (
    <button type="button" onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition ${aktif ? 'bg-black text-white border-black' : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'}`}>{children}</button>
  );

  return (
    <div className="space-y-3 animate-in fade-in">
      {/* ---------------------------------------------------- FİLTRELER */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-3 space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-black text-neutral-400 uppercase mr-1">Durum:</span>
          {[['tumu', 'Tümü', sayac(() => true)], ['bekleyen', 'Personel bekliyor', sayac(bekliyorMu)], ['bot', 'Bot', sayac(k => k.mode !== 'human')], ['human', 'Personel', sayac(k => k.mode === 'human')]].map(([id, ad, n]) => (
            <Cip key={id} aktif={filtre.mod === id} onClick={() => setFiltre(f => ({ ...f, mod: id }))}>{ad} ({n})</Cip>
          ))}
          <span className="w-px h-5 bg-neutral-200 mx-1" />
          {[['tumu', 'Tümü'], ['yok', 'Portföyde olmayanlar'], ['var', 'Portföydekiler']].map(([id, ad]) => (
            <Cip key={id} aktif={portfoy === id} onClick={() => setPortfoy(id)}>{ad}</Cip>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={filtre.arama} onChange={e => setFiltre(f => ({ ...f, arama: e.target.value }))} placeholder="İsim ya da numara ara"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-100 text-sm font-bold outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <select value={filtre.marka} onChange={e => setFiltre(f => ({ ...f, marka: e.target.value }))}
            className="px-2 py-2 rounded-xl text-[11px] font-black border border-neutral-200 bg-white">
            <option value="tumu">Tüm hatlar</option><option value="depoevim">DepoEvim</option><option value="sembol">Sembol</option>
          </select>
          <span className="text-[10px] font-black text-neutral-400 uppercase ml-1 flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Zaman:</span>
          {HAVUZ_ZAMANLAR.map(([id, ad]) => (
            <button key={id} type="button" onClick={() => setZaman(id)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border transition ${zaman === id ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'}`}>{ad}</button>
          ))}
        </div>
      </div>

      {/* ---------------------------------------------------- LİSTE (gün blokları) */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="hidden md:grid grid-cols-[1.4fr_2fr_1fr_auto] gap-3 px-4 py-2.5 bg-black text-white text-xs font-black">
          <span>Müşteri</span><span>Son Mesaj</span><span>Hat · Durum</span><span className="text-right pr-1">İşlem</span>
        </div>
        {yukleniyor && <p className="p-6 text-center text-sm font-bold text-neutral-400"><Loader2 className="w-4 h-4 inline animate-spin mr-1" /> Yükleniyor…</p>}
        {okumaHatasi && <p className="p-6 text-center text-sm font-bold text-red-600">{okumaHatasi}</p>}
        {!yukleniyor && !okumaHatasi && liste.length === 0 && <p className="p-8 text-center text-sm font-bold text-neutral-400">Bu filtrede konuşma yok.</p>}
        {bloklar.map(([gun, kl]) => {
          const fark = gunFarki(gun, simdiMs);
          const bekleyen = kl.filter(bekliyorMu).length;
          return (
            <div key={gun || 'yok'}>
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border-y border-green-100">
                <span className="w-1 h-5 rounded bg-green-600" />
                <CalendarDays className="w-4 h-4 text-green-700" />
                <span className="text-sm font-black text-neutral-900">{gunBasligi(gun)} Mesajları</span>
                {fark === 0 && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-600 text-white">Bugün</span>}
                {fark === 1 && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-neutral-800 text-white">Dün</span>}
                <span className="ml-auto text-[11px] font-bold text-neutral-500">{kl.length} konuşma{bekleyen ? <b className="text-red-600"> · {bekleyen} bekliyor</b> : ''}</span>
              </div>
              {kl.map(k => {
                const okunmamis = Number(k.unreadCount) || 0;
                const marka = konusmaMarkasi(k);
                const pf = portfoyHaritasi[k.id];
                const tel = String(k.phone || k.waId || '').replace(/\D/g, '');
                return (
                  <div key={k.id} onClick={() => setAcikId(k.id)}
                    className={`relative grid grid-cols-1 md:grid-cols-[1.4fr_2fr_1fr_auto] gap-2 md:gap-3 items-center pl-4 pr-3 py-2.5 border-b border-neutral-100 cursor-pointer hover:bg-neutral-50 ${bekliyorMu(k) ? 'bg-red-50/40' : ''}`}>
                    <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${marka === 'depoevim' ? 'bg-blue-600' : 'bg-red-600'}`} />
                    {/* Müşteri */}
                    <div className="min-w-0 flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-black shrink-0">
                        {(k.profileName || '?').trim().charAt(0).toLocaleUpperCase('tr-TR') || '?'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className={`text-sm truncate ${okunmamis ? 'font-black text-black' : 'font-bold text-neutral-900'}`}>{k.profileName || 'WhatsApp Müşterisi'}</p>
                          {okunmamis > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-green-600 text-white text-[10px] font-black flex items-center justify-center">{okunmamis}</span>}
                        </div>
                        <p className="text-[11px] font-bold text-neutral-500">{k.phone || k.waId} · {listeSaati(k.lastMessageAt, simdiMs)}</p>
                      </div>
                    </div>
                    {/* Son mesaj */}
                    <p className={`text-[12px] line-clamp-2 ${okunmamis ? 'text-neutral-900 font-bold' : 'text-neutral-600'}`}>{k.lastMessagePreview || '—'}</p>
                    {/* Hat · durum */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${MARKA_RENK[marka]}`}>{MARKA_ETIKETI[marka]}</span>
                      <ModRozeti k={k} />
                      {bekliyorMu(k) && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-red-600 text-white animate-pulse">Personel bekliyor</span>}
                    </div>
                    {/* İşlem */}
                    <div className="flex items-center gap-1.5 justify-end flex-wrap" onClick={e => e.stopPropagation()}>
                      <button type="button" onClick={() => setAcikId(k.id)}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-black bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 shadow-md shadow-green-600/20">
                        <Eye className="w-3.5 h-3.5" /> Sohbeti Aç
                      </button>
                      {tel && <a href={`tel:+${tel}`} className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white" title="Ara"><Phone className="w-3.5 h-3.5" /></a>}
                      {pf ? (
                        <button type="button" onClick={() => onPortfoyAc?.(pf, k)} title="Benim Müşterilerim'de aç"
                          className="px-2.5 py-1.5 rounded-xl text-[11px] font-black border border-green-300 bg-green-50 text-green-800 flex items-center gap-1">
                          <Briefcase className="w-3.5 h-3.5" /> Portföyde{pf.sahip ? ` · ${pf.sahip}` : ''}
                        </button>
                      ) : onPortfoyeEkle && (
                        <button type="button" disabled={ekleniyor === k.id} onClick={() => portfoyeEkle(k)} title="Benim Müşterilerim'e WHATSAPP TEKLİF olarak ekle"
                          className="px-2.5 py-1.5 rounded-xl text-[11px] font-black border border-green-600 text-green-700 hover:bg-green-50 flex items-center gap-1 disabled:opacity-50">
                          {ekleniyor === k.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />} Portföye Ekle
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ---------------------------------------------------- SOHBET PENCERESİ (aynı sayfada) */}
      {acik && (
        <div className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-2 md:p-6" onClick={() => setAcikId(null)}>
          <div className="bg-white w-full max-w-3xl h-[88vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <WhatsAppSohbet key={acik.id} konusma={acik} currentUser={currentUser} yonetici={yonetici}
              onGeri={() => setAcikId(null)} geriHerZaman onLeadAc={onLeadAc ? (id) => { setAcikId(null); onLeadAc(id); } : undefined}
              onGorselAc={onGorselAc} kaynak={kaynak} simdi={simdi} />
            {/* Portföy kısayolu — sohbet içinden de */}
            <div className="px-3 py-2 border-t border-neutral-200 bg-neutral-50 flex items-center gap-2">
              {portfoyHaritasi[acik.id] ? (
                <button type="button" onClick={() => { const pf = portfoyHaritasi[acik.id]; setAcikId(null); onPortfoyAc?.(pf, acik); }}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-black border border-green-300 bg-green-50 text-green-800 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" /> Portföyde{portfoyHaritasi[acik.id].sahip ? ` · ${portfoyHaritasi[acik.id].sahip}` : ''} — Benim Müşterilerim'de aç
                </button>
              ) : onPortfoyeEkle && (
                <button type="button" disabled={!!ekleniyor} onClick={async () => { const k = acik; setAcikId(null); await portfoyeEkle(k); }}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-black bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 disabled:opacity-50">
                  <Users className="w-3.5 h-3.5" /> Portföye Ekle (WhatsApp Teklif)
                </button>
              )}
              <button type="button" onClick={() => setAcikId(null)} className="ml-auto px-3 py-1.5 rounded-xl text-[11px] font-black border border-neutral-300 bg-white hover:bg-neutral-100 flex items-center gap-1"><X className="w-3.5 h-3.5" /> Kapat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppView;
