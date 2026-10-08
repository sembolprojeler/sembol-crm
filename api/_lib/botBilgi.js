// api/_lib/botBilgi.js
// ============================================================================
// Sembol CRM — BOT BİLGİ BANKASI: SUNUCU OKUMA / YAZMA (2026-10-08)
// ----------------------------------------------------------------------------
// Şema, sınırlar, doğrulama, bota giden metin: src/botBilgiSema.js
//   bot_bilgi/{marka}                → { icerik, surumId, kaydeden, kaydedilme, kaynak, toplam }
//   bot_bilgi/{marka}/surumler/{id}  → aynı alanlar (son SURUM_SAYISI sürüm; eskiler silinir)
//   kaynak: { tur: 'elle' | 'word' | 'geriAl', dosyaAdi?, url?, geriAlinanSurum? }
// Okuma (webhook): belge başına 60 sn bellek önbelleği — kayıt en geç 1 dakikada bota yansır.
// Belge yok / bozuk / okunamıyor → '' (bot yedek metni kullanır: botTalimatlari.js).
// Yazma YALNIZCA api/whatsapp-send.js (botBilgiKaydet / botBilgiGeriAl) üzerinden.
// ============================================================================
import { randomBytes } from 'node:crypto';
import { veriKoku } from './whatsapp.js';
import { botBilgiDogrula, botBilgiMetni, SURUM_SAYISI } from '../../src/botBilgiSema.js';

export const botBilgiRef = (db, appId, marka) => veriKoku(db, appId).collection('bot_bilgi').doc(String(marka));
export const surumlerRef = (db, appId, marka) => botBilgiRef(db, appId, marka).collection('surumler');

export const ONBELLEK_MS = 60 * 1000;
const onbellek = new Map();
export const botBilgiOnbelleginiTemizle = () => onbellek.clear();

// Bota giden bilgi metni ('' → yedek). Asla fırlatmaz.
export async function botBilgiMetniOku(db, appId, marka, simdi = Date.now()) {
  const anahtar = `${appId}/${marka}`;
  const o = onbellek.get(anahtar);
  if (o && simdi - o.zaman < ONBELLEK_MS) return o.metin;
  let metin = '';
  try {
    const s = await botBilgiRef(db, appId, marka).get();
    if (s.exists) {
      const d = botBilgiDogrula(s.data()?.icerik);
      if (d.ok) metin = botBilgiMetni(d.icerik);
      else console.error('[bot-bilgi] belge geçersiz, yedek metin kullanılıyor', marka, d.hata);
    }
  } catch (err) {
    // Okuma hatası önbelleğe alınmaz: sonraki mesajda yeniden denenir
    console.error('[bot-bilgi] okunamadı, yedek metin kullanılıyor', marka, err?.message);
    return '';
  }
  onbellek.set(anahtar, { zaman: simdi, metin });
  return metin;
}

const yeniSurumId = (simdi) => `s_${simdi}_${randomBytes(4).toString('hex')}`;

// tabanSurum: sayfanın açıldığı andaki surumId (belge yoksa null) — farklıysa biri bu arada kaydetmiş → 409
// { ok: true, surumId, kaydedilme } | { ok: false, kod, hata, sebep }
export async function botBilgiKaydet(db, appId, marka, { icerik, kim, kaynak = { tur: 'elle' }, tabanSurum = null, simdi = Date.now() }) {
  const d = botBilgiDogrula(icerik);
  if (!d.ok) return { ok: false, kod: 400, sebep: 'gecersiz', hata: d.hata };
  const ref = botBilgiRef(db, appId, marka);
  const surumId = yeniSurumId(simdi);
  const kaydedilme = new Date(simdi).toISOString();
  const kayit = { icerik: d.icerik, toplam: d.toplam, surumId, kaydeden: { id: String(kim.id), ad: String(kim.ad || '') }, kaydedilme, kaynak };
  const sonuc = await db.runTransaction(async (t) => {
    const s = await t.get(ref);
    const mevcut = s.exists ? s.data()?.surumId || null : null;
    if ((tabanSurum || null) !== mevcut) return { ok: false, kod: 409, sebep: 'cakisma', hata: 'Bu arada başka bir yönetici kaydetti. Sayfayı yenileyip değişikliklerinizi yeniden uygulayın.' };
    t.set(ref, kayit);
    t.set(surumlerRef(db, appId, marka).doc(surumId), kayit);
    return { ok: true, surumId, kaydedilme };
  });
  if (!sonuc.ok) return sonuc;
  botBilgiOnbelleginiTemizle();
  await eskiSurumleriSil(db, appId, marka).catch(err => console.error('[bot-bilgi] eski sürümler silinemedi', err?.message));
  return { ...sonuc, toplam: d.toplam };
}

async function eskiSurumleriSil(db, appId, marka) {
  const snap = await surumlerRef(db, appId, marka).orderBy('kaydedilme', 'desc').get();
  for (const doc of snap.docs.slice(SURUM_SAYISI)) await surumlerRef(db, appId, marka).doc(doc.id).delete();
}

// Eski bir sürümün içeriği yeni sürüm olarak kaydedilir (geçmiş silinmez)
export async function botBilgiGeriAl(db, appId, marka, { surumId, kim, tabanSurum = null, simdi = Date.now() }) {
  const s = await surumlerRef(db, appId, marka).doc(String(surumId)).get();
  if (!s.exists) return { ok: false, kod: 404, sebep: 'surum_yok', hata: 'Sürüm bulunamadı (10 sürümden eski olabilir).' };
  const eski = s.data() || {};
  const kaynak = { tur: 'geriAl', geriAlinanSurum: String(surumId), geriAlinanTarih: eski.kaydedilme || '',
    ...(eski.kaynak?.dosyaAdi ? { dosyaAdi: eski.kaynak.dosyaAdi } : {}), ...(eski.kaynak?.url ? { url: eski.kaynak.url } : {}) };
  return botBilgiKaydet(db, appId, marka, { icerik: eski.icerik, kim, kaynak, tabanSurum, simdi });
}
