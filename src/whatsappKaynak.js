// src/whatsappKaynak.js
// ============================================================================
// CRM WhatsApp paneli — VERİ KAYNAĞI (Firestore dinleyicileri + /api/whatsapp-send)
// Okuma: Firestore (kurallarda açık). Yazma: YALNIZCA sunucu ucu (personelId + şifre).
// src/WhatsApp.jsx varsayılan olarak bunu kullanır; önizleme / testte sahte kaynak verilir.
// ============================================================================
import { useEffect, useState } from 'react';
import { collection, doc, limit, limitToLast, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db, appId } from './shared.jsx';

const kok = () => ['artifacts', appId, 'public', 'data'];
const belgeler = (s) => s.docs.map(d => ({ id: d.id, ...d.data() }));

export const firestoreKaynagi = {
  konusmalariDinle: (cb, hata) => onSnapshot(
    query(collection(db, ...kok(), 'whatsapp_conversations'), orderBy('lastMessageAt', 'desc'), limit(100)), s => cb(belgeler(s)), hata),
  mesajlariDinle: (kid, cb, hata) => onSnapshot(
    query(collection(db, ...kok(), 'whatsapp_conversations', kid, 'messages'), orderBy('timestamp', 'asc'), limitToLast(200)), s => cb(belgeler(s)), hata),
  durumDinle: (cb) => {
    const durum = {};
    const dinle = (ad) => onSnapshot(doc(db, ...kok(), 'whatsapp_durum', ad), s => { durum[ad] = s.exists() ? s.data() : null; cb({ ...durum }); }, () => {});
    const u1 = dinle('token'), u2 = dinle('ai');
    return () => { u1(); u2(); };
  },
  bekleyenleriDinle: (cb) => onSnapshot(
    query(collection(db, ...kok(), 'whatsapp_conversations'), where('needsAgent', '==', true), limit(99)), s => cb(s.size), () => cb(0)),
  istek: async (govde) => {
    try {
      const r = await fetch('/api/whatsapp-send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) });
      const j = await r.json().catch(() => ({}));
      return { durum: r.status, ...j, ok: r.ok && j.ok !== false };
    } catch {
      return { durum: 0, ok: false, hata: 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.' };
    }
  },
};

// Menü rozeti: personel bekleyen konuşma sayısı (yalnızca yetkisi olanda dinlenir)
export function useWhatsappBekleyen(aktif, kaynak = firestoreKaynagi) {
  const [sayi, setSayi] = useState(0);
  useEffect(() => (aktif ? kaynak.bekleyenleriDinle(setSayi) : undefined), [aktif, kaynak]);
  return aktif ? sayi : 0;
}
