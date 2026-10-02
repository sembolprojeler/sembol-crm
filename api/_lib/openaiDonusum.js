// api/_lib/openaiDonusum.js
// ============================================================================
// OpenAI (ChatGPT reklamları) sunucu tarafı dönüşüm bildirimi
// ----------------------------------------------------------------------------
// submit-lead.js, ChatGPT reklamından gelen bir teklif TAMAMLANINCA (ya da
// "Beni Siz Arayın" talebi gelince) Firestore'a yazdıktan sonra buradaki
// olayGonder()'i @vercel/functions waitUntil ile çalıştırır — yanıt gecikmez,
// Vercel de fonksiyonu istek bitmeden kapatmaz. Ara kayıtta (partial) ASLA
// gönderilmez.
//
// Ortam değişkenleri (hiçbiri yoksa bildirim sessizce atlanır):
//   OPENAI_PIXEL_ID          → tek değer (tüm sitelere) ya da site başına:
//                              "sembolevdeneve:U5H4…,depoevim:XYZ…"
//   OPENAI_CONVERSIONS_KEY   → Bearer anahtarı (aynı biçimde site başına da
//                              verilebilir). ASLA loglanmaz.
//   OPENAI_CAPI_TEST         → "1" ise validate_only:true (OpenAI doğrular,
//                              dönüşüm saymaz)
//   OPENAI_DONUSUM_SITELERI  → bildirimi gönderen siteler (hesapId), virgülle;
//                              varsayılan "sembolevdeneve"
// ============================================================================

import { AI_PLATFORMLARI } from '../../src/aiKaynakSema.js';

export const OPENAI_OLAY_UCU = 'https://bzr.openai.com/v1/events';
export const OPENAI_VARSAYILAN_SOURCE_URL = 'https://www.sembolevdeneve.com/fiyat-teklifi-al/';
export const OPENAI_ZAMAN_ASIMI_MS = 5000;
// Yalnızca bu sihirbaz durumları "tamamlanmış teklif" sayılır.
export const OPENAI_DONUSUM_STATULERI = ['completed', 'callback_requested'];
// Bildirim yalnızca ChatGPT reklam kaynağı için (kod aiKaynakSema tablosundan).
export const OPENAI_REKLAM_KODU = AI_PLATFORMLARI.find(p => p.id === 'chatgpt').reklam.kod;

// "deger" ya da "site1:deger1,site2:deger2" → bu sitenin değeri
function siteDegeri(ham, site) {
  const s = String(ham || '').trim();
  if (!s) return '';
  if (!s.includes(':')) return s;
  const eslesme = s.split(',').map(x => x.trim()).find(x => x.split(':')[0].trim() === site);
  return eslesme ? eslesme.slice(eslesme.indexOf(':') + 1).trim() : '';
}

// Bu site için ayarlar; bildirim gönderilemeyecekse null (sessizce atlanır).
export function openaiAyarlari(env, site) {
  const e = env || {};
  const siteler = String(e.OPENAI_DONUSUM_SITELERI || 'sembolevdeneve').split(',').map(x => x.trim()).filter(Boolean);
  if (!siteler.includes(site)) return null;
  const pixelId = siteDegeri(e.OPENAI_PIXEL_ID, site);
  const anahtar = siteDegeri(e.OPENAI_CONVERSIONS_KEY, site);
  if (!pixelId || !anahtar) return null;
  return { pixelId, anahtar, test: e.OPENAI_CAPI_TEST === '1' };
}

// Gönderilmeli mi? onceki: kaydın bu istekten ÖNCEKİ hâli. Daha önce başarılı
// (gerçek) gönderim varsa tekrar gönderilmez — ör. önce "Beni Siz Arayın",
// sonra formu tamamlama tek olay sayılır.
export function donusumGonderilmeli({ status, reklamKaynagi, onceki }) {
  if (!OPENAI_DONUSUM_STATULERI.includes(status)) return false;
  if (reklamKaynagi !== OPENAI_REKLAM_KODU) return false;
  return !(onceki && onceki.openaiDonusum && onceki.openaiDonusum.durum === 'gonderildi');
}

// Olay gövdesi. id her zaman Firestore belge id'si — ileride tarayıcıdan da
// olay gönderilirse OpenAI ikisini aynı id ile tekilleştirir.
export function olayGovdesi({ belgeId, sourceUrl, test, simdi }) {
  const olay = {
    id: belgeId,
    type: 'lead_created',
    timestamp_ms: simdi,
    source_url: sourceUrl || OPENAI_VARSAYILAN_SOURCE_URL,
    action_source: 'web',
    data: { type: 'customer_action' },
  };
  // İLERİDE (şimdilik GÖNDERİLMİYOR): reklam tıklama kimliği
  // (kayit.pazarlama.tiklamaKimlikleri.chatgpt — alan adı
  // src/aiKaynakSema.js'teki tiklamaKimligiAlani) ve kullanıcı eşleştirme
  // alanları (ör. hash'lenmiş telefon) OpenAI'ın belgelediği adlarla buraya
  // eklenecek.
  return { validate_only: !!test, events: [olay] };
}

// Olayı gönderir; HİÇBİR ZAMAN hata fırlatmaz. Dönen nesne kayda
// "openaiDonusum" olarak yazılır: { durum, httpKodu, zaman }.
//   durum: gonderildi | test_gonderildi | hata | zaman_asimi
export async function olayGonder({ ayar, belgeId, sourceUrl, fetchFn = fetch, zamanAsimiMs = OPENAI_ZAMAN_ASIMI_MS }) {
  const denetci = new AbortController();
  const sayac = setTimeout(() => denetci.abort(), zamanAsimiMs);
  const zaman = () => new Date().toISOString();
  try {
    const yanit = await fetchFn(`${OPENAI_OLAY_UCU}?pid=${encodeURIComponent(ayar.pixelId)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ayar.anahtar}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(olayGovdesi({ belgeId, sourceUrl, test: ayar.test, simdi: Date.now() })),
      signal: denetci.signal,
    });
    if (yanit.ok) return { durum: ayar.test ? 'test_gonderildi' : 'gonderildi', httpKodu: yanit.status, zaman: zaman() };
    // Yanıt gövdesinin kısa bir kısmı hata ayıklama için loglanır (anahtar içermez)
    let ozet = '';
    try { ozet = (await yanit.text()).slice(0, 300); } catch { /* yok say */ }
    console.error(`[openai-donusum] ${belgeId} HTTP ${yanit.status}: ${ozet}`);
    return { durum: 'hata', httpKodu: yanit.status, zaman: zaman() };
  } catch (err) {
    const zamanAsimi = err && err.name === 'AbortError';
    console.error(`[openai-donusum] ${belgeId} ${zamanAsimi ? 'zaman aşımı' : `ağ hatası: ${err && err.message}`}`);
    return { durum: zamanAsimi ? 'zaman_asimi' : 'hata', httpKodu: null, zaman: zaman() };
  } finally {
    clearTimeout(sayac);
  }
}
