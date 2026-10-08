// Bot Bilgileri (2026-10-08): src/botBilgiSema.js, api/_lib/botBilgi.js, api/whatsapp-send.js (botBilgi* işlemleri)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sahteDb, sahteYanit } from './yardimci.js';

process.env.FIRESTORE_APP_ID = 'test-app';
const S = await import('../src/botBilgiSema.js');
const { botBilgiMetniOku, botBilgiOnbelleginiTemizle, ONBELLEK_MS } = await import('../api/_lib/botBilgi.js');
const { handlerOlustur } = await import('../api/whatsapp-send.js');
const { sistemTalimati, DEPOEVIM_BILGI_YEDEK } = await import('../api/_lib/botTalimatlari.js');
const { sayfadanCikilsinMi, kaydedilmemisAyarla } = await import('../src/kaydedilmemisUyari.js');

const kok = (db) => db.collection('artifacts').doc('test-app').collection('public').doc('data');
const bilgi = (ek = {}) => ({ bolumler: { ...S.varsayilanBotBilgi('depoevim').bolumler, ...ek }, sss: [] });
let SAAT = Date.parse('2026-10-08T09:00:00Z');

async function kur({ aiCevabi = { ok: true, cikti: { reply: 'Kartal şubemize randevuyla gelebilirsiniz.', intent: 'kiralik_depo', handoff: false } } } = {}) {
  botBilgiOnbelleginiTemizle();
  const db = sahteDb();
  const personel = {
    FS: { fullName: 'Ali Şimşek', position: 'Firma Sahibi', password: 'a' },
    YO: { fullName: 'Yönetici Hanım', position: 'Operasyon Yöneticisi', password: 'y' },
    MU: { fullName: 'Müdür Bey', position: 'Satış Temsilcisi', rank: 'Müdür', password: 'm' },
    CE: { fullName: 'Düzenleyen', position: 'Satış Temsilcisi', password: 'c', permissions: { canEdit: true } },
    ST: { fullName: 'Satışçı', position: 'Satış Temsilcisi', password: 's' },
    PY: { fullName: 'Eski Yönetici', position: 'Operasyon Yöneticisi', password: 'p', employmentStatus: 'Pasif' },
  };
  for (const [id, p] of Object.entries(personel)) await kok(db).collection('personnelList').doc(id).set(p);
  await kok(db).collection('settings').doc('company').set({ positionModules: { 'Satış Temsilcisi': { addJob: true } } });
  const gonderilen = [], aiCagrilari = [];
  const fetchFn = async (url) => { gonderilen.push(String(url)); return { ok: true, status: 200, json: async () => ({}) }; };
  const aiUret = async (a) => { aiCagrilari.push(a); return aiCevabi; };
  const handler = handlerOlustur({ getDb: () => db, fetchFn, env: { FIRESTORE_APP_ID: 'test-app' }, simdi: () => SAAT, aiUret });
  const istek = async (govde) => { const r = sahteYanit(); await handler({ method: 'POST', headers: {}, body: govde }, r); return r; };
  return { db, istek, gonderilen, aiCagrilari };
}
const ana = (db) => db.belge('bot_bilgi/depoevim');
const surumler = (db) => [...db.belgeler.entries()].filter(([k]) => k.includes('bot_bilgi/depoevim/surumler/')).map(([, v]) => v);
const FS = { personelId: 'FS', sifre: 'a' };

// ------------------------------------------------------------------ ŞEMA
test('ilk içerik: botTalimatlari.js\'deki eski sabit bilgilerin hepsi bölümlerde; sınırların içinde', () => {
  const ilk = S.varsayilanBotBilgi('depoevim');
  assert.equal(S.botBilgiDogrula(ilk).ok, true);
  const metin = S.botBilgiMetni(ilk);
  for (const parca of ["2004'ten beri", 'Allianz', '0545 240 84 61', 'Kartal (Yalı', 'Gebze', '1+0 = 10 m³', '6 ay peşin', 'IBAN',
    'depo-fiyatlarimiz', 'Taahhüt yok', 'İKİ AYRI HİZMET', 'kurumsal arşiv', 'ödeme / kart bilgisi isteme']) assert.ok(metin.includes(parca), parca);
  assert.ok(S.karakterSayisi(ilk) < S.BOT_BILGI_SINIRLARI.toplam);
  assert.equal(DEPOEVIM_BILGI_YEDEK, metin);
});

test('doğrulama: bilinmeyen alan / tür / sınır reddedilir; metinler temizlenir', () => {
  assert.equal(S.botBilgiDogrula({ bolumler: {}, sss: [], fazla: 1 }).ok, false);
  assert.equal(S.botBilgiDogrula({ bolumler: { kural: 'x' } }).ok, false);
  assert.equal(S.botBilgiDogrula({ bolumler: { firma: 5 } }).ok, false);
  assert.equal(S.botBilgiDogrula({ bolumler: { firma: 'x'.repeat(4001) } }).ok, false);
  assert.equal(S.botBilgiDogrula({ sss: [{ soru: 'a', cevap: 'b', x: 1 }] }).ok, false);
  assert.equal(S.botBilgiDogrula({ sss: Array.from({ length: 51 }, () => ({ soru: 'a', cevap: 'b' })) }).ok, false);
  const ucBolum = Object.fromEntries(['firma', 'subeler', 'kurallar', 'odeme'].map(id => [id, 'x'.repeat(3500)]));
  assert.match(S.botBilgiDogrula({ bolumler: ucBolum }).hata, /Toplam 14000 karakter; sınır 12000/);
  const d = S.botBilgiDogrula({ bolumler: { firma: '  a\r\nb\u0007 ' }, sss: [{ soru: ' S ', cevap: 'C' }, { soru: '', cevap: '' }] });
  assert.equal(d.icerik.bolumler.firma, 'a\nb'); assert.deepEqual(d.icerik.sss, [{ soru: 'S', cevap: 'C' }]);
});

test('bota giden metin: TL tutarları gizlenir (1.000 altı da), m³ / telefon / yıl kalır; "asla" bölümü kesin kural', () => {
  const m = S.botBilgiMetni(bilgi({ odeme: 'Kutu 50 TL, aylık 1.500 TL, ₺200, 300 lira, 2.000 TRY', asla: 'İndirim sözü verme.' }));
  assert.doesNotMatch(m, /50 TL|1\.500|₺200|300 lira|2\.000 TRY/);
  assert.equal(m.split(S.FIYAT_YER_TUTUCU).length - 1, 5);
  assert.match(m, /10 m³/); assert.match(m, /0545 240 84 61/); assert.match(m, /2004'ten/);
  assert.match(m, /\[ASLA SÖYLEME \/ SÖZ VERME — KESİN KURAL\]\nİndirim sözü verme\./);
  assert.equal(S.botBilgiMetni({ bolumler: {}, sss: [] }), '');
});

test('yetki: yalnızca Sistem Yöneticisi / Firma Sahibi / Müdür / "Yönetici" — canEdit ve pasif AÇMAZ', () => {
  assert.equal(S.botBilgiYetkisi({ fullName: 'Sistem Yöneticisi' }), true);
  assert.equal(S.botBilgiYetkisi({ position: 'Firma Sahibi' }), true);
  assert.equal(S.botBilgiYetkisi({ rank: 'Müdür' }), true);
  assert.equal(S.botBilgiYetkisi({ position: 'Operasyon Yöneticisi' }), true);
  assert.equal(S.botBilgiYetkisi({ position: 'Satış Temsilcisi', permissions: { canEdit: true } }), false);
  assert.equal(S.botBilgiYetkisi({ position: 'Operasyon Yöneticisi', employmentStatus: 'Pasif' }), false);
  assert.equal(S.botBilgiYetkisi(null), false);
});

// ------------------------------------------------------------------ WORD
test('Word: başlıklı belge bölümlere, tanınmayan başlık ve başlıksız giriş "Diğer"e', () => {
  const html = '<p>Giriş notu</p><h1>Şubeler ve ziyaret saatleri</h1><p>Kartal şubesi</p><p>Hafta içi 09-18</p>'
    + '<h2>2) Ödeme</h2><ul><li>IBAN ile</li></ul><h1>Kampanyasız Ek</h1><p>bir şey</p><h1>Personel Notları</h1><p>iç not</p>'
    + '<p>Kurallar:</p><p>Taahhüt yok.</p><p>Yasaklı eşyalar</p><p>Asla söyleme / söz verme</p><p>Kesin tarih verme.</p>';
  const r = S.wordBloklariniDagit(S.htmlBloklari(html));
  assert.equal(r.bolumler.subeler, 'Kartal şubesi\nHafta içi 09-18');
  assert.equal(r.bolumler.odeme, '- IBAN ile\nbir şey'); // "Kampanyasız" → Ödeme (önek eşleşmesi)
  assert.equal(r.bolumler.diger, 'Giriş notu\nPersonel Notları:\niç not');
  assert.equal(r.bolumler.kurallar, 'Taahhüt yok.\nYasaklı eşyalar'); // içerik satırı başlık sayılmaz
  assert.equal(r.bolumler.asla, 'Kesin tarih verme.');
  assert.deepEqual(r.sss, []);
});

test('Word: başlıksız belge tamamen "Diğer bilgiler"e; SSS kalıpları (Soru:/Cevap:, S:/C:, "?" satırı) listeye', () => {
  const duz = S.wordBloklariniDagit(S.htmlBloklari('<p>Depolarımız temizdir.</p><p>Kartal şubesi</p>'));
  assert.equal(duz.bolumler.diger, 'Depolarımız temizdir.\nKartal şubesi');
  assert.ok(S.METIN_BOLUMLERI.filter(id => id !== 'diger').every(id => duz.bolumler[id] === ''));
  const sss = S.wordBloklariniDagit(S.htmlBloklari(
    '<p>Soru: Sigorta var mı?</p><p>Cevap: Evet.</p><p>Allianz ile.</p><p>S: Hafta sonu açık mı?</p><p>C: Hayır.</p>'
    + '<h1>Sık sorulan sorular</h1><p>Depoya ne zaman girebilirim?</p><p>Randevuyla.</p><h1>Firma</h1><p>2004 kuruluş</p>'));
  assert.deepEqual(sss.sss, [
    { soru: 'Sigorta var mı?', cevap: 'Evet. Allianz ile.' },
    { soru: 'Hafta sonu açık mı?', cevap: 'Hayır.' },
    { soru: 'Depoya ne zaman girebilirim?', cevap: 'Randevuyla.' },
  ]);
  assert.equal(sss.bolumler.firma, '2004 kuruluş');
});

test('Word şablonu (public/bot-bilgi-sablonu.docx) içe aktarılınca ilk içerik + 2 SSS örneği çıkar', async () => {
  const mammoth = (await import('mammoth')).default;
  const r = await mammoth.convertToHtml({ buffer: readFileSync(new URL('../public/bot-bilgi-sablonu.docx', import.meta.url)) });
  const d = S.wordBloklariniDagit(S.htmlBloklari(r.value));
  const ilk = S.varsayilanBotBilgi('depoevim');
  // Girintiler dahil BİREBİR ("  1) EŞYA DEPOLAMA …")
  for (const id of S.METIN_BOLUMLERI) assert.equal(d.bolumler[id], ilk.bolumler[id], id);
  assert.match(d.bolumler.firma, /\n {2}1\) EŞYA DEPOLAMA/);
  assert.equal(d.sss.length, 2);
  // Şablon değiştirilmeden geri yüklenirse yalnızca örnek SSS farklıdır
  assert.deepEqual(S.farkliBolumler(ilk, d), ['sss']);
});

test('Word girintisi: satır başı boşluk / sekme / nbsp korunur; girintili başlık ve SSS yine tanınır', () => {
  const bloklar = S.htmlBloklari('<h1>Firma</h1><p>Hizmetler:</p><p>  1) Eşya   depolama</p><p>\t2) Kiralık depo</p><p>&nbsp;&nbsp;&nbsp;- not</p>'
    + '<p>   Ödeme:</p><p>    IBAN ile</p><p>  S: Sigorta var mı?</p><p>  C:  Evet.</p>');
  assert.deepEqual(bloklar.slice(1, 5).map(b => b.metin), ['Hizmetler:', '  1) Eşya depolama', '  2) Kiralık depo', '   - not']);
  const d = S.wordBloklariniDagit(bloklar);
  assert.equal(d.bolumler.firma, 'Hizmetler:\n  1) Eşya depolama\n  2) Kiralık depo\n   - not'); // "Hizmetler:" bir bölüme eşleşmez → içerik
  assert.equal(d.bolumler.odeme, '    IBAN ile'); // girintili "Ödeme:" başlık sayıldı
  assert.deepEqual(d.sss, [{ soru: 'Sigorta var mı?', cevap: 'Evet.' }]);
});

test('karşılaştırma boşluk farklarını yok sayar: yalnızca girintisi / satır sonu / çift boşluğu farklı bölüm "farklı" değildir', () => {
  const mevcut = { bolumler: { ...S.varsayilanBotBilgi('x').bolumler, firma: '- A\n  1) B', odeme: 'IBAN ile' }, sss: [{ soru: 'Sigorta var mı?', cevap: 'Evet.' }] };
  const yalnizBosluk = { bolumler: { firma: '- A\n1)   B', odeme: '  IBAN\r\nile ' }, sss: [{ soru: ' Sigorta  var mı?', cevap: 'Evet. ' }] };
  assert.deepEqual(S.farkliBolumler(mevcut, yalnizBosluk), []);
  const gercek = { bolumler: { firma: '- A\n  1) C', odeme: 'IBAN ile' }, sss: [{ soru: 'Sigorta var mı?', cevap: 'Hayır.' }] };
  assert.deepEqual(S.farkliBolumler(mevcut, gercek), ['firma', 'sss']);
  // "Değiştir" seçilirse Word'deki girinti taslağa aynen geçer
  assert.equal(S.taslakBirlestir(mevcut, gercek, { firma: 'degistir' }).bolumler.firma, '- A\n  1) C');
});

test('taslak birleştirme: değiştir / ekle / yoksay; yalnızca farklı bölümler listelenir', () => {
  const mevcut = { bolumler: { ...S.varsayilanBotBilgi('x').bolumler, firma: 'A', odeme: 'IBAN', kurallar: 'K' }, sss: [{ soru: 'q', cevap: 'a' }] };
  const gelen = { bolumler: { firma: 'B', odeme: 'Kart', kurallar: 'Y', subeler: '' , nakliye: 'N' }, sss: [{ soru: 'q2', cevap: 'a2' }] };
  assert.deepEqual(S.farkliBolumler(mevcut, gelen), ['firma', 'kurallar', 'odeme', 'nakliye', 'sss']);
  const s = S.taslakBirlestir(mevcut, gelen, { firma: 'degistir', odeme: 'ekle', kurallar: 'yoksay', sss: 'ekle' });
  assert.equal(s.bolumler.firma, 'B'); assert.equal(s.bolumler.odeme, 'IBAN\nKart'); assert.equal(s.bolumler.kurallar, 'K');
  assert.equal(s.bolumler.nakliye, ''); // seçim yok → değişmez
  assert.equal(s.sss.length, 2);
  assert.match(S.wordDosyaAdi('depoevim', SAAT, 'ab12cd'), /^botbilgi_depoevim_20261008-0900_ab12cd\.docx$/);
});

test('kaydedilmemiş değişiklik: menü değişimi onay ister; vazgeçilirse kalır', () => {
  kaydedilmemisAyarla(null);
  assert.equal(sayfadanCikilsinMi(() => false), true);
  kaydedilmemisAyarla('Kaydedilmemiş değişiklik var');
  assert.equal(sayfadanCikilsinMi(() => false), false);
  assert.equal(sayfadanCikilsinMi(() => true), true);
  assert.equal(sayfadanCikilsinMi(() => false), true); // onaylandıktan sonra uyarı temizlenir
});

// ------------------------------------------------------------------ SUNUCU OKUMA (bot)
test('bot okuması: dolu → bilgi bankası, boş / bozuk / okunamıyor → "" (yedek); 60 sn önbellek', async () => {
  const { db } = await kur();
  assert.equal(await botBilgiMetniOku(db, 'test-app', 'depoevim', SAAT), ''); // belge yok
  await kok(db).collection('bot_bilgi').doc('depoevim').set({ icerik: bilgi({ firma: 'YENİ FİRMA BİLGİSİ' }), surumId: 's1' });
  // önbellek: 60 sn dolmadan eski değer
  assert.equal(await botBilgiMetniOku(db, 'test-app', 'depoevim', SAAT + 1000), '');
  assert.match(await botBilgiMetniOku(db, 'test-app', 'depoevim', SAAT + ONBELLEK_MS), /YENİ FİRMA BİLGİSİ/);
  // bozuk belge → yedek
  botBilgiOnbelleginiTemizle();
  await kok(db).collection('bot_bilgi').doc('depoevim').set({ icerik: { bolumler: { firma: 42 } } });
  assert.equal(await botBilgiMetniOku(db, 'test-app', 'depoevim', SAAT), '');
  // okunamıyor → yedek, önbelleğe alınmaz
  botBilgiOnbelleginiTemizle();
  const bozukDb = { collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({ get: async () => { throw new Error('ağ'); } }) }) }) }) }) }) };
  assert.equal(await botBilgiMetniOku(bozukDb, 'test-app', 'depoevim', SAAT), '');
  // sistem talimatı: boşken yedek, doluyken bilgi bankası; sabit kurallar her iki durumda
  const yedek = sistemTalimati({ marka: 'depoevim', bilgiMetni: '' });
  const dolu = sistemTalimati({ marka: 'depoevim', bilgiMetni: S.botBilgiMetni(bilgi({ firma: 'YENİ FİRMA BİLGİSİ' })) });
  assert.match(yedek, /2004'ten beri/); assert.match(dolu, /YENİ FİRMA BİLGİSİ/);
  for (const t of [yedek, dolu]) { assert.match(t, /\(Sabit kural\) TÜM DepoEvim fiyatlarını "\+KDV"/); assert.match(t, /alım adresi İstanbul dışı diye reddetme/); }
});

// ------------------------------------------------------------------ SUNUCU İŞLEMLERİ
test('kaydet: yönetici kaydeder (sürüm + kaydeden + kaynak); canEdit / satışçı / pasif / yanlış şifre reddedilir', async () => {
  const o = await kur();
  const icerik = bilgi({ firma: 'Elle yazıldı' });
  for (const [kim, kod] of [[{ personelId: 'CE', sifre: 'c' }, 403], [{ personelId: 'ST', sifre: 's' }, 403], [{ personelId: 'PY', sifre: 'p' }, 403], [{ personelId: 'FS', sifre: 'yanlis' }, 401]]) {
    const r = await o.istek({ islem: 'botBilgiKaydet', marka: 'depoevim', icerik, ...kim });
    assert.equal(r.kod, kod, kim.personelId);
  }
  assert.equal(ana(o.db), undefined);
  assert.equal((await o.istek({ islem: 'botBilgiKaydet', marka: 'sembol', icerik, ...FS })).kod, 400); // Sembol henüz kapalı
  assert.equal((await o.istek({ islem: 'botBilgiKaydet', marka: 'depoevim', icerik: { bolumler: { firma: 'x'.repeat(5000) } }, ...FS })).kod, 400);
  const r = await o.istek({ islem: 'botBilgiKaydet', marka: 'depoevim', icerik, tabanSurum: null,
    kaynak: { tur: 'word', dosyaAdi: 'bilgi.docx', url: 'https://www.sembolevdeneve.com/crm/uploads/botbilgi_depoevim_x.docx' }, personelId: 'MU', sifre: 'm' });
  assert.equal(r.kod, 200);
  const d = ana(o.db);
  assert.equal(d.icerik.bolumler.firma, 'Elle yazıldı'); assert.equal(d.kaydeden.ad, 'Müdür Bey'); assert.equal(d.surumId, r.govde.surumId);
  assert.deepEqual(d.kaynak, { tur: 'word', dosyaAdi: 'bilgi.docx', url: 'https://www.sembolevdeneve.com/crm/uploads/botbilgi_depoevim_x.docx' });
  assert.equal(surumler(o.db).length, 1);
  // Dışarıdan URL kabul edilmez (yalnızca crm/uploads); arşive yüklenemediyse yalnızca dosya adı
  SAAT += 1000;
  await o.istek({ islem: 'botBilgiKaydet', marka: 'depoevim', icerik: bilgi({ firma: 'iki' }), tabanSurum: d.surumId, kaynak: { tur: 'word', dosyaAdi: 'b.docx', url: 'https://kotu.example/x.docx' }, ...FS });
  assert.deepEqual(ana(o.db).kaynak, { tur: 'word', dosyaAdi: 'b.docx' });
  assert.equal(o.gonderilen.length, 0);
});

test('kaydet: başkası bu arada kaydettiyse 409 (üzerine yazılmaz); 10 sürümden eskiler silinir', async () => {
  const o = await kur();
  const r1 = await o.istek({ islem: 'botBilgiKaydet', marka: 'depoevim', icerik: bilgi({ firma: 'v1' }), tabanSurum: null, ...FS });
  const cakisma = await o.istek({ islem: 'botBilgiKaydet', marka: 'depoevim', icerik: bilgi({ firma: 'eski sayfa' }), tabanSurum: null, personelId: 'YO', sifre: 'y' });
  assert.equal(cakisma.kod, 409); assert.equal(ana(o.db).icerik.bolumler.firma, 'v1');
  let taban = r1.govde.surumId;
  for (let i = 2; i <= 12; i++) {
    SAAT += 60000;
    const r = await o.istek({ islem: 'botBilgiKaydet', marka: 'depoevim', icerik: bilgi({ firma: `v${i}` }), tabanSurum: taban, ...FS });
    assert.equal(r.kod, 200); taban = r.govde.surumId;
  }
  const s = surumler(o.db);
  assert.equal(s.length, 10);
  assert.deepEqual(s.map(x => x.icerik.bolumler.firma).sort(), ['v10', 'v11', 'v12', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9']);
});

test('geri al: eski sürümün içeriği YENİ sürüm olur (geçmiş silinmez); yetkisiz 403, olmayan sürüm 404', async () => {
  const o = await kur();
  const r1 = await o.istek({ islem: 'botBilgiKaydet', marka: 'depoevim', icerik: bilgi({ firma: 'ilk' }), tabanSurum: null,
    kaynak: { tur: 'word', dosyaAdi: 'ilk.docx', url: 'https://www.sembolevdeneve.com/crm/uploads/botbilgi_a.docx' }, ...FS });
  SAAT += 60000;
  const r2 = await o.istek({ islem: 'botBilgiKaydet', marka: 'depoevim', icerik: bilgi({ firma: 'ikinci' }), tabanSurum: r1.govde.surumId, ...FS });
  assert.equal((await o.istek({ islem: 'botBilgiGeriAl', marka: 'depoevim', surumId: r1.govde.surumId, tabanSurum: r2.govde.surumId, personelId: 'CE', sifre: 'c' })).kod, 403);
  assert.equal((await o.istek({ islem: 'botBilgiGeriAl', marka: 'depoevim', surumId: 'yok', tabanSurum: r2.govde.surumId, ...FS })).kod, 404);
  SAAT += 60000;
  const g = await o.istek({ islem: 'botBilgiGeriAl', marka: 'depoevim', surumId: r1.govde.surumId, tabanSurum: r2.govde.surumId, personelId: 'YO', sifre: 'y' });
  assert.equal(g.kod, 200);
  const d = ana(o.db);
  assert.equal(d.icerik.bolumler.firma, 'ilk'); assert.equal(d.kaydeden.ad, 'Yönetici Hanım');
  assert.equal(d.kaynak.tur, 'geriAl'); assert.equal(d.kaynak.geriAlinanSurum, r1.govde.surumId); assert.equal(d.kaynak.dosyaAdi, 'ilk.docx');
  assert.equal(surumler(o.db).length, 3);
  // geri alınan içerik bota gider
  assert.match(await botBilgiMetniOku(o.db, 'test-app', 'depoevim', SAAT + ONBELLEK_MS), /\[Firma\]\nilk/);
});

test('Dene: kayıtlı / taslak / yedek bilgiyle yapay zeka çağrılır; müşteriye hiçbir şey gitmez, Firestore\'a yazılmaz', async () => {
  const o = await kur({ aiCevabi: { ok: true, cikti: { reply: 'Aylık kira 1.500 TL.', intent: 'kiralik_depo', handoff: true, handoffType: 'bildir', handoffReason: 'Randevu' } } });
  const once = new Map(o.db.belgeler);
  // kayıt yok → yedek
  let r = await o.istek({ islem: 'botBilgiDene', marka: 'depoevim', soru: 'Fiyat?', kaynak: 'kayitli', ...FS });
  assert.equal(r.kod, 200); assert.equal(r.govde.bilgiKaynagi, 'yedek'); assert.match(o.aiCagrilari[0].sistem, /2004'ten beri/);
  assert.match(r.govde.uyari, /sistemin hesaplamadığı bir tutar/); assert.equal(r.govde.handoff, true);
  assert.deepEqual(o.aiCagrilari[0].gecmis, [{ rol: 'musteri', metin: 'Fiyat?' }]);
  // taslak (kaydedilmemiş) → yalnızca bu denemede kullanılır
  r = await o.istek({ islem: 'botBilgiDene', marka: 'depoevim', soru: 'Sigorta?', kaynak: 'taslak', icerik: bilgi({ kurallar: 'TASLAK KURAL 99 TL' }), ...FS });
  assert.equal(r.govde.bilgiKaynagi, 'taslak'); assert.match(o.aiCagrilari[1].sistem, /TASLAK KURAL \[fiyat: Fiyat Tablosu'ndan\]/);
  assert.doesNotMatch(o.aiCagrilari[1].sistem, /99 TL/);
  // taslak geçersizse 400, yetkisiz 403
  assert.equal((await o.istek({ islem: 'botBilgiDene', marka: 'depoevim', soru: 'x', kaynak: 'taslak', icerik: { bolumler: { firma: 1 } }, ...FS })).kod, 400);
  assert.equal((await o.istek({ islem: 'botBilgiDene', marka: 'depoevim', soru: 'x', kaynak: 'kayitli', personelId: 'ST', sifre: 's' })).kod, 403);
  // hiçbir belge değişmedi, hiçbir istek Meta'ya gitmedi; taslak bota yansımadı
  assert.deepEqual([...o.db.belgeler.keys()].sort(), [...once.keys()].sort());
  assert.equal(o.gonderilen.length, 0);
  assert.equal(await botBilgiMetniOku(o.db, 'test-app', 'depoevim', SAAT), '');
});
