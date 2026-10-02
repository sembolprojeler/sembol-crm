// scripts/ai-kaynak-yeniden-siniflandir.mjs
// ============================================================================
// TEK SEFERLİK: eski Müşteri Havuzu kayıtlarını yapay zeka eşleme tablosuyla
// (src/aiKaynakSema.js) yeniden sınıflandırır.
//
// Varsayılan KURU ÇALIŞTIRMA — hiçbir şey yazmaz, yalnızca kaç kaydın nasıl
// değişeceğini gösterir:
//   node --env-file=.env.local scripts/ai-kaynak-yeniden-siniflandir.mjs
// Gerçekten yazmak için:
//   node --env-file=.env.local scripts/ai-kaynak-yeniden-siniflandir.mjs --uygula
//
// Gerekli ortam: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
// FIREBASE_PRIVATE_KEY, FIRESTORE_APP_ID (api/submit-lead.js ile aynı).
//
// Kural: canlı uçlarla AYNI karar (api/_lib/pazarlama.js → reklamKaynagiKarar).
// İz olarak kullanılanlar: pazarlama{}, sayfaUrl (iniş adresi → utm_*),
// digerSiteAdi (yönlendiren site → referrer). DOKUNULMAYANLAR: QR'a bağlı
// kayıtlar, ödemeli reklamlar (Google/Facebook/Instagram Ads) ve zaten bir
// yapay zeka kaynağı taşıyanlar. Eski değer "aiOncekiReklamKaynagi"ya yazılır
// (geri almak için).
// ============================================================================

import { pathToFileURL } from 'node:url';
import { aiKaynakMi } from '../src/aiKaynakSema.js';
import { PAID_ADS_DEGERLERI, reklamKaynagiKarar, pazarlamaOku } from '../api/_lib/pazarlama.js';

// Saf karar fonksiyonu (testlenir): değişecekse { yeni, karar }, yoksa null.
export function yenidenSiniflandir(k) {
  if (!k || k.qrKampanyaId || k.reklamKaynagi === 'qr') return null;
  if (PAID_ADS_DEGERLERI.includes(k.reklamKaynagi) || aiKaynakMi(k.reklamKaynagi)) return null;
  const iz = {
    ...pazarlamaOku({ landing_url: k.sayfaUrl, utm_source: k.utmSource, utm_medium: k.utmMedium }),
    ...(k.digerSiteAdi ? { referrer: String(k.digerSiteAdi) } : {}),
    ...(k.pazarlama || {}),
  };
  const { reklamKaynagi, karar } = reklamKaynagiKarar(k.reklamKaynagi, iz);
  if (!aiKaynakMi(reklamKaynagi) || reklamKaynagi === k.reklamKaynagi) return null;
  return { yeni: reklamKaynagi, karar };
}

async function main() {
  const uygula = process.argv.includes('--uygula');
  const appId = process.env.FIRESTORE_APP_ID;
  if (!appId) { console.error('FIRESTORE_APP_ID tanımlı değil.'); process.exit(1); }

  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  initializeApp({ credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  }) });
  const db = getFirestore();
  const kol = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('havuzKayitlari');

  const snap = await kol.get();
  const degisecek = [];
  const digerSiteler = {};
  snap.forEach(d => {
    const k = d.data();
    if (k.reklamKaynagi === 'diger_site' && k.digerSiteAdi) digerSiteler[k.digerSiteAdi] = (digerSiteler[k.digerSiteAdi] || 0) + 1;
    const s = yenidenSiniflandir(k);
    if (s) degisecek.push({ id: d.id, eski: k.reklamKaynagi || '(yok)', ...s, iz: k.digerSiteAdi || k.pazarlama?.referrer || k.pazarlama?.utmSource || k.sayfaUrl || '', createdAt: k.createdAt || '' });
  });

  console.log(`Toplam kayıt: ${snap.size}`);
  console.log(`Değişecek kayıt: ${degisecek.length}`);
  const ozet = {};
  degisecek.forEach(x => { const a = `${x.eski} → ${x.yeni}`; ozet[a] = (ozet[a] || 0) + 1; });
  console.table(ozet);
  console.log('Örnekler (en fazla 30):');
  console.table(degisecek.slice(0, 30).map(x => ({ id: x.id, tarih: x.createdAt.slice(0, 10), eski: x.eski, yeni: x.yeni, karar: x.karar, iz: x.iz.slice(0, 60) })));
  console.log('Bilgi — "Diğer Site" kayıtlarındaki yönlendiren siteler (ilk 20):');
  console.table(Object.entries(digerSiteler).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([site, adet]) => ({ site, adet })));

  if (!uygula) { console.log('\nKURU ÇALIŞTIRMA — hiçbir şey yazılmadı. Yazmak için --uygula ekleyin.'); return; }

  const zaman = new Date().toISOString();
  for (let i = 0; i < degisecek.length; i += 400) {
    const batch = db.batch();
    degisecek.slice(i, i + 400).forEach(x => batch.update(kol.doc(x.id), {
      reklamKaynagi: x.yeni,
      aiOncekiReklamKaynagi: x.eski === '(yok)' ? null : x.eski,
      kaynakKarari: `betik_${x.karar}`,
      aiYenidenSiniflandirma: zaman,
    }));
    await batch.commit();
  }
  console.log(`\n${degisecek.length} kayıt güncellendi.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(err => { console.error(err); process.exit(1); });
}
