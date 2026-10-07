// scripts/whatsapp-devir-raporu.mjs
// ============================================================================
// SALT OKUNUR: mode "human" (bot susmuş) WhatsApp konuşmalarını listeler ve yeni
// kurala (api/whatsapp-webhook.js → sessizModKarari) göre müşterinin bir sonraki
// mesajında ne olacağını gösterir. HİÇBİR ŞEY YAZMAZ.
//   node --env-file=.env.local scripts/whatsapp-devir-raporu.mjs
//   node --env-file=.env.local scripts/whatsapp-devir-raporu.mjs 8761   (numaranın son 4 hanesiyle süz)
//
// Gerekli ortam: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY,
// FIRESTORE_APP_ID (api/whatsapp-webhook.js ile aynı). Numaralar maskeli yazılır.
// ============================================================================
import { sessizModKarari } from '../api/whatsapp-webhook.js';
import { maskele } from '../api/_lib/whatsapp.js';

const KARAR_METNI = {
  ai_hatasi: 'AÇILIR — eski yapay zeka hatası devri (needsAgent kalkar)',
  eski_bildir: 'AÇILIR — eski "bildir" türü devir (needsAgent kalır)',
  '24_saat': 'AÇILIR — 24 saat geçti (needsAgent korunur)',
  sessiz_personel: 'SESSİZ — personel yazıyor (otomatik mesaj yok)',
  sessiz: 'SESSİZ — personel yazmadı (3 saatte bir bilgi mesajı)',
};

async function main() {
  const appId = process.env.FIRESTORE_APP_ID;
  if (!appId) { console.error('FIRESTORE_APP_ID tanımlı değil.'); process.exit(1); }
  const son4 = (process.argv[2] || '').replace(/\D/g, '');
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  initializeApp({ credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  }) });
  const kok = getFirestore().collection('artifacts').doc(appId).collection('public').doc('data').collection('whatsapp_conversations');
  const snap = await kok.where('mode', '==', 'human').get();
  const simdi = Date.now();
  let n = 0;
  for (const d of snap.docs) {
    const k = d.data();
    if (son4 && !String(k.waId || d.id).endsWith(son4)) continue;
    const mesajlar = (await d.ref.collection('messages').orderBy('timestamp', 'desc').limit(50).get()).docs.map(m => m.data());
    const { karar, dayanak } = sessizModKarari(k, mesajlar, simdi);
    n++;
    console.log([
      `${maskele(k.waId || d.id)}${d.id.includes('_') ? ` (hat ${d.id.split('_')[0]})` : ''}`,
      `  handoffReason : ${JSON.stringify(k.handoffReason ?? null)}`,
      `  handoffAt     : ${k.handoffAt || '-'}   devirTuru: ${k.devirTuru || '- (eski kayıt)'}   needsAgent: ${!!k.needsAgent}`,
      `  personel mesajı: ${mesajlar.filter(m => m.from === 'agent').length}   son müşteri mesajı: ${k.lastCustomerMessageAt || '-'}`,
      `  sonraki mesajda: ${KARAR_METNI[karar]}${karar.startsWith('sessiz') && dayanak ? ` — 24 saat kuralı: ${new Date(Date.parse(dayanak) + 86400000).toISOString()}` : ''}`,
    ].join('\n'));
  }
  console.log(`\n${n} konuşma (mode "human")${son4 ? `, son 4 hane ${son4}` : ''}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
