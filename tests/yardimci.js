// tests/yardimci.js — sahte Firestore ve sahte req/res (testler gerçek
// Firebase'e ya da ağa HİÇ dokunmaz).

// Yalnızca submit-lead'in kullandığı zincir: collection().doc()…doc(id) → { get, set, update }
export function sahteDb() {
  const belgeler = new Map();
  const ref = (yol) => ({
    id: yol.split('/').pop(),
    async get() {
      const v = belgeler.get(yol);
      return { exists: v !== undefined, data: () => (v === undefined ? undefined : structuredClone(v)) };
    },
    async set(veri, ops) {
      const onceki = belgeler.get(yol);
      belgeler.set(yol, ops && ops.merge && onceki ? derinBirlestir(onceki, veri) : structuredClone(veri));
    },
    async update(veri) {
      const onceki = belgeler.get(yol);
      if (onceki === undefined) throw new Error('belge yok');
      belgeler.set(yol, { ...onceki, ...structuredClone(veri) });
    },
    // YENİ (WhatsApp testleri): Firestore create() — belge varsa ALREADY_EXISTS (kod 6)
    async create(veri) {
      if (belgeler.has(yol)) throw Object.assign(new Error('ALREADY_EXISTS'), { code: 6 });
      belgeler.set(yol, structuredClone(veri));
    },
    collection: (ad) => koleksiyon(`${yol}/${ad}`),
  });
  // YENİ: doc() kimliksiz (otomatik kimlik), orderBy / limit / get (yalnızca doğrudan alt belgeler)
  let otoKimlik = 0;
  const sorgu = (yol, sirala = null, sinir = null) => ({
    orderBy: (alan, yon = 'asc') => sorgu(yol, { alan, yon }, sinir),
    limit: (n) => sorgu(yol, sirala, n),
    async get() {
      let docs = [...belgeler.entries()]
        .filter(([k]) => k.startsWith(`${yol}/`) && !k.slice(yol.length + 1).includes('/'))
        .map(([k, v]) => ({ id: k.split('/').pop(), data: () => structuredClone(v) }));
      if (sirala) docs.sort((a, b) => {
        const x = a.data()[sirala.alan], y = b.data()[sirala.alan];
        return (x < y ? -1 : x > y ? 1 : 0) * (sirala.yon === 'desc' ? -1 : 1);
      });
      if (sinir != null) docs = docs.slice(0, sinir);
      return { docs, empty: !docs.length, size: docs.length };
    },
  });
  const koleksiyon = (yol) => ({ doc: (id) => ref(`${yol}/${id ?? `oto${++otoKimlik}`}`), ...sorgu(yol) });
  return {
    collection: (ad) => koleksiyon(ad),
    // YENİ: sıralı (seri) transaction — testler için yeterli
    runTransaction: async (fn) => fn({
      get: (r) => r.get(), set: (r, v, o) => r.set(v, o), update: (r, v) => r.update(v), create: (r, v) => r.create(v),
    }),
    // Test kolaylığı: leadId ile havuz kaydını oku
    havuz: (leadId) => belgeler.get(`artifacts/${process.env.FIRESTORE_APP_ID}/public/data/havuzKayitlari/${leadId}`),
    // YENİ: ham belge okuma (yol: "artifacts/…" ya da veri köküne göre "whatsapp_conversations/…")
    belge: (yol) => belgeler.get(yol.startsWith('artifacts/') ? yol : `artifacts/${process.env.FIRESTORE_APP_ID}/public/data/${yol}`),
    belgeler,
  };
}

// Firestore set(..., {merge:true}) gibi: iç içe nesneler birleşir, dizi/değer üzerine yazılır
function derinBirlestir(a, b) {
  const sonuc = structuredClone(a);
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && sonuc[k] && typeof sonuc[k] === 'object' && !Array.isArray(sonuc[k])) {
      sonuc[k] = derinBirlestir(sonuc[k], v);
    } else {
      sonuc[k] = structuredClone(v);
    }
  }
  return sonuc;
}

export function sahteIstek(body) {
  return { method: 'POST', headers: { origin: 'https://www.sembolevdeneve.com' }, body };
}

export function sahteYanit() {
  const r = { kod: null, govde: null, basliklar: {} };
  r.setHeader = (k, v) => { r.basliklar[k] = v; };
  r.status = (kod) => { r.kod = kod; return r; };
  r.json = (g) => { r.govde = g; return r; };
  r.end = () => r;
  return r;
}
