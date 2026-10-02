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
    collection: (ad) => koleksiyon(`${yol}/${ad}`),
  });
  const koleksiyon = (yol) => ({ doc: (id) => ref(`${yol}/${id}`) });
  return {
    collection: (ad) => koleksiyon(ad),
    // Test kolaylığı: leadId ile havuz kaydını oku
    havuz: (leadId) => belgeler.get(`artifacts/${process.env.FIRESTORE_APP_ID}/public/data/havuzKayitlari/${leadId}`),
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
