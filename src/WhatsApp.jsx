// src/WhatsApp.jsx
// ============================================================================
// CRM — WHATSAPP PANELİ (Satış → WhatsApp)
// ----------------------------------------------------------------------------
// Solda konuşma listesi, sağda sohbet. Veriler Firestore dinleyicisiyle canlı gelir
// (okuma kurallarda zaten açık); YAZMA yalnızca sunucudan: /api/whatsapp-send
// (gonder / devral / botaVer / okundu — personelId + şifre ile, api/_lib/crmYetki.js).
// Mantık (24 saat penceresi, sıralama, etiketler, sekme başlığı) → src/whatsappPanel.js.
// Medya indirme / önizleme YOK (sonraki aşama): görsel, ses, belge etiketle; konum harita linkiyle.
// "kaynak" prop'u test/önizleme içindir; varsayılan src/whatsappKaynak.js (Firestore + /api/whatsapp-send).
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, Bot, UserCheck, Search, ExternalLink, MapPin, AlertTriangle, ArrowLeft, Lock, Loader2, X } from 'lucide-react';
import { firestoreKaynagi } from './whatsappKaynak.js';
import { pencereAcikMi, pencereKalan, konusmalariSuz, mesajGorunumu, durumBilgisi, dikkatSayisi, sekmeBasligi, bekliyorMu,
  listeSaati, konusmaMarkasi, MARKA_ETIKETI, PENCERE_UYARISI, SIFRE_YOK_MESAJI } from './whatsappPanel.js';

const MARKA_RENK = { depoevim: 'bg-blue-50 text-blue-700 border-blue-200', sembol: 'bg-red-50 text-red-700 border-red-200' };
const mesajSaati = (iso, simdi) => {
  const t = new Date(iso || '');
  if (Number.isNaN(t.getTime())) return '';
  const saat = t.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
  const gun = listeSaati(iso, simdi);
  return gun.includes(':') ? saat : `${gun} ${saat}`;
};

const ModRozeti = ({ k }) => (k.mode === 'human'
  ? <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300"><UserCheck className="w-3 h-3" /> Personel</span>
  : <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200"><Bot className="w-3 h-3" /> Bot</span>);

export const WhatsAppView = ({ currentUser, yonetici = false, acIstegi = null, onLeadAc, kaynak = firestoreKaynagi, simdi = () => Date.now() }) => {
  const [konusmalar, setKonusmalar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [okumaHatasi, setOkumaHatasi] = useState('');
  const [seciliId, setSeciliId] = useState(null);
  const [mesajKutusu, setMesajKutusu] = useState({ kid: null, liste: [] });
  const [islenenIstek, setIslenenIstek] = useState(null);
  const [filtre, setFiltre] = useState({ marka: 'tumu', mod: 'tumu', arama: '' });
  const [metin, setMetin] = useState('');
  const [isleniyor, setIsleniyor] = useState('');
  const [hata, setHata] = useState('');
  const [durum, setDurum] = useState({});
  const sonRef = useRef(null);
  const okunduIstendi = useRef('');

  useEffect(() => kaynak.konusmalariDinle(
    (l) => { setKonusmalar(l); setYukleniyor(false); setOkumaHatasi(''); },
    () => { setYukleniyor(false); setOkumaHatasi('Konuşmalar okunamadı. Sayfayı yenileyin.'); }), [kaynak]);
  useEffect(() => kaynak.durumDinle(setDurum), [kaynak]);

  const sec = (kid) => { setSeciliId(kid); setMetin(''); setHata(''); };
  // Lead ekranından gelen "sohbeti aç" isteği — her yeni istek (no) bir kez uygulanır
  if (acIstegi?.konusmaId && acIstegi.no !== islenenIstek) { setIslenenIstek(acIstegi.no); sec(acIstegi.konusmaId); }

  useEffect(() => {
    if (!seciliId) return undefined;
    return kaynak.mesajlariDinle(seciliId, (liste) => setMesajKutusu({ kid: seciliId, liste }), () => setHata('Mesajlar okunamadı.'));
  }, [seciliId, kaynak]);
  const mesajlar = mesajKutusu.kid === seciliId ? mesajKutusu.liste : [];

  useEffect(() => { sonRef.current?.scrollIntoView?.({ block: 'end' }); }, [mesajlar.length, seciliId]);

  // Sekme başlığı: "(2) WhatsApp – CRM" — panelden çıkınca eski başlık geri gelir
  const ilkBaslik = useRef(typeof document !== 'undefined' ? document.title : '');
  const dikkat = dikkatSayisi(konusmalar);
  useEffect(() => { document.title = sekmeBasligi(dikkat); }, [dikkat]);
  useEffect(() => () => { document.title = ilkBaslik.current; }, []);

  const secili = konusmalar.find(k => k.id === seciliId) || null;
  const liste = useMemo(() => konusmalariSuz(konusmalar, filtre), [konusmalar, filtre]);
  const kimlik = { personelId: currentUser?.id, sifre: currentUser?.password };

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
    setIsleniyor(islem); setHata('');
    const r = await kaynak.istek({ islem, konusmaId: secili.id, ...kimlik, ...ek });
    setIsleniyor('');
    if (!r.ok) { setHata(r.hata || 'İşlem yapılamadı.'); return false; }
    return true;
  };
  const gonder = async () => {
    const m = metin.trim();
    if (!m || !secili || isleniyor) return;
    if (await islemYap('gonder', { metin: m })) setMetin('');
  };

  const acik = secili ? pencereAcikMi(secili, simdi()) : false;
  const devralanBen = secili?.devralan?.id && String(secili.devralan.id) === String(currentUser?.id);
  const botaVerebilir = secili?.mode === 'human' && (!secili?.devralan?.id || devralanBen || yonetici);
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
          ) : (<>
            <div className="px-3 py-2.5 border-b border-neutral-200 flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => sec(null)} className="md:hidden p-1.5 rounded-lg hover:bg-neutral-100"><ArrowLeft className="w-5 h-5" /></button>
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
                const d = durumBilgisi(m);
                const sag = g.kimden !== 'musteri';
                const renk = g.kimden === 'musteri' ? 'bg-white' : g.kimden === 'personel' ? 'bg-[#d9fdd3]' : 'bg-sky-50 border border-sky-100';
                return (
                  <div key={m.id} className={`flex ${sag ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-2.5 py-1.5 shadow-sm ${renk}`}>
                      {g.ad && <p className={`text-[10px] font-black mb-0.5 ${g.kimden === 'personel' ? 'text-green-700' : 'text-sky-700'}`}>
                        {g.kimden === 'bot' && <Bot className="w-3 h-3 inline mr-0.5 -mt-0.5" />}{g.ad}{g.otomatik ? ' · otomatik' : ''}</p>}
                      <p className={`text-[13px] whitespace-pre-wrap break-words ${g.medya ? 'italic text-neutral-600' : 'text-neutral-900'}`}>{g.metin}</p>
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
          </>)}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppView;
