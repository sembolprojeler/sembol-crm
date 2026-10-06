// api/_lib/lead.js — WhatsApp botunun lead kaydı (sihirbazla aynı biçim)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whatsappLeadKaydi, webLeadKaydi, refKoduBul, refKoduTemizle, refBelgeId, waTelefonCrm, leadAcikMi,
  whatsappAlanlariniTemizle } from '../api/_lib/lead.js';

const SAAT = '2026-10-06T12:00:00.000Z';
const evdenEve = { homeSize: '3+1', fromCity: 'İstanbul (Anadolu)', fromDistrict: 'Kadıköy', fromFloor: '4', fromElevator: 'merdiven',
  toCity: 'Bursa', toDistrict: 'İnegöl', toFloor: '2', toElevator: 'bina_asansoru', paketleme: 'firma', moveDate: '2026-11-01' };

test('ilk kayıt: sihirbazla aynı sonMesaj, kanal/kaynak whatsapp, KVKK aydınlatma (kvkkOnay yok)', () => {
  const { kayit } = whatsappLeadKaydi({ marka: 'sembol', collected: { ...evdenEve, fullName: 'Ayşe Yılmaz' }, waId: '905321234567',
    profilAdi: 'Ayşe', ilkKayit: true, fiyat: { min: 30000, max: 37500 }, nowIso: SAAT });
  // Aynı alanlarla web sihirbazı kaydının sonMesaj'ı (başlık dahil) birebir aynı olmalı
  const web = webLeadKaydi({ body: { ...evdenEve, priceMin: 30000, priceMax: 37500 }, wizardType: 'evdenEve', ilkKayit: true, nowIso: SAAT }).kayit;
  assert.equal(kayit.sonMesaj, web.sonMesaj);
  assert.equal(kayit.kanal, 'whatsapp');
  assert.equal(kayit.kaynak, 'whatsapp');
  assert.equal(kayit.kayitTipi, 'whatsapp-bot');
  assert.equal(kayit.hesapId, 'sembolevdeneve');
  assert.equal(kayit.hizmetTipi, 'Nakliye');
  assert.equal(kayit.musteriAdi, 'Ayşe Yılmaz');
  assert.equal(kayit.iletisim, '0532 123 45 67');
  assert.equal(kayit.durum, 'Yeni');
  assert.equal(kayit.reklamKaynagi, 'direkt_giris');
  assert.equal(kayit.fiyatTahminiMin, 30000);
  assert.deepEqual(kayit.guzergah, web.guzergah);
  assert.equal(kayit.kvkkAydinlatma, true);
  assert.equal(kayit.kvkkAydinlatmaKanal, 'whatsapp');
  assert.equal(kayit.kvkkAydinlatmaTarihi, SAAT);
  assert.equal('kvkkOnay' in kayit, false);
});

test('DepoEvim: hesapId depoevim, hizmetTipi Depo, teklifAlanlari sihirbaz alanlarıyla', () => {
  const { kayit, wizardType } = whatsappLeadKaydi({ marka: 'depoevim', collected: { depoBoyutu: '15', kiralamaSuresi: '6', sube: 'kartal',
    teslimSekli: 'anahtar_teslim', pickupCity: 'İstanbul (Anadolu)', pickupDistrict: 'Maltepe' }, waId: '905551112233', ilkKayit: true,
    fiyat: { aylik: 3500, toplam: 17500, nakliyeMin: 9000, nakliyeMax: 11000 }, nowIso: SAAT });
  assert.equal(wizardType, 'depoevimDepolama');
  assert.equal(kayit.hesapId, 'depoevim');
  assert.equal(kayit.hizmetTipi, 'Depo');
  assert.equal(kayit.teklifAlanlari.sube, 'kartal');
  assert.equal(kayit.teklifAlanlari.nakliyeMin, 9000);
  assert.match(kayit.sonMesaj, /^\[DepoEvim - Eşya Depolama\]/);
  assert.match(kayit.sonMesaj, /Tahmini Alım\/Nakliye Ücreti: 9\.000 - 11\.000 TL/);
  assert.equal(kayit.musteriAdi, 'WhatsApp Müşterisi');
});

test('ref ile tıklama kaydına bağlanma: reklam kaynağı / durum korunur, hareket eklenir, ad profil adından', () => {
  const tiklama = { sadeceTiklama: true, musteriAdi: 'Google Ads Ziyaretçisi', reklamKaynagi: 'google_ads', durum: 'Yeni', hareketler: [{ islem: 'tık' }] };
  const { kayit } = whatsappLeadKaydi({ marka: 'sembol', collected: { homeSize: '2+1' }, waId: '905321234567', profilAdi: 'Mehmet', onceki: tiklama, ilkKayit: false, nowIso: SAAT });
  assert.equal('reklamKaynagi' in kayit, false);
  assert.equal('durum' in kayit, false);
  assert.equal(kayit.sadeceTiklama, false);
  assert.equal(kayit.musteriAdi, 'Mehmet');
  assert.equal(kayit.hareketler.length, 2);
});

test('güncelleme: CRM\'deki ad, durum ve KVKK tarihi korunur; tamamlanınca bir kez hareket', () => {
  const onceki = { musteriAdi: 'Ayşe Hanım', durum: 'Görüşme Sağlandı', kvkkAydinlatmaTarihi: '2026-10-01', hareketler: [{}], wizardDurumu: 'partial' };
  const { kayit } = whatsappLeadKaydi({ collected: evdenEve, waId: '905321234567', profilAdi: 'A', onceki, ilkKayit: false, tamamlandi: true, nowIso: SAAT });
  assert.equal(kayit.musteriAdi, 'Ayşe Hanım');
  assert.equal('durum' in kayit, false);
  assert.equal('kvkkAydinlatmaTarihi' in kayit, false);
  assert.equal(kayit.wizardDurumu, 'completed');
  assert.equal(kayit.hareketler.length, 2);
  const ikinci = whatsappLeadKaydi({ collected: evdenEve, waId: '1', onceki: { ...onceki, wizardDurumu: 'completed' }, ilkKayit: false, tamamlandi: true }).kayit;
  assert.equal('hareketler' in ikinci, false);
});

test('ref kodu: bulunur, metinden temizlenir, belge kimliği', () => {
  assert.deepEqual(refKoduBul('Merhaba fiyat alabilir miyim? (Ref: sb-7k2qf)'), { kod: 'SB-7K2QF', marka: 'sembol' });
  assert.deepEqual(refKoduBul('(Ref: DE-AB12C) depo'), { kod: 'DE-AB12C', marka: 'depoevim' });
  assert.equal(refKoduBul('Merhaba'), null);
  assert.equal(refKoduTemizle('Merhaba fiyat (Ref: SB-7K2QF)'), 'Merhaba fiyat');
  assert.equal(refBelgeId('sb-7k2qf'), 'ref_SB-7K2QF');
});

test('telefon biçimi, açık lead, alan beyaz listesi', () => {
  assert.equal(waTelefonCrm('905321234567'), '0532 123 45 67');
  assert.equal(waTelefonCrm('447700900123'), '447700900123');
  assert.equal(leadAcikMi({ durum: 'Yeni' }), true);
  assert.equal(leadAcikMi({}), true);
  assert.equal(leadAcikMi({ durum: 'İşi Aldık' }), false);
  assert.equal(leadAcikMi({ durum: 'Reddedildi' }), false);
  assert.equal(leadAcikMi(null), false);
  assert.deepEqual(whatsappAlanlariniTemizle({ homeSize: '2+1', durum: 'İşi Aldık', fromFloor: 3, dateFlexible: 'true', fullName: '  Ali   Veli ' }),
    { homeSize: '2+1', fromFloor: 3, dateFlexible: true, fullName: 'Ali Veli' });
});
