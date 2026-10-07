// api/_lib/crmYetki.js
// ============================================================================
// Sembol CRM — SUNUCU TARAFI PERSONEL KONTROLÜ (GEÇİCİ, 2026-10-07)
// ----------------------------------------------------------------------------
// api/whatsapp-send kullanır: "herkes 0850'den mesaj atamasın" diye en basit kontrol.
// CRM girişi bugün tarayıcıda yapılıyor (anonim Firebase oturumu + personnelList'teki
// şifre); Firebase ID token personeli KANITLAMAZ. Bu yüzden istek personelId + şifre
// taşır, sunucu Admin SDK ile personnelList/{id} belgesini okuyup giriş ekranıyla AYNI
// biçimde karşılaştırır. Personel girişi geçişi (custom token) yapılınca bu dosya
// token doğrulamasıyla değiştirilecek.
//
// Yetki kuralları src/App.jsx ile birebir aynıdır:
//   checkAccess(key)      → Pasif: hayır · süper yönetici: evet · kişiye özel → pozisyon → rütbe → hayır
//   altSatisErisimi(key)  → addJob yoksa hayır · kişiye özel → pozisyon → rütbe → evet (üst bölümü miras)
// ============================================================================

export const SIFRE_YOK_MESAJI = 'Panelden mesaj göndermek için kullanıcı adı ve şifreyle giriş yapın.';

const superAdminMi = (p) => p?.fullName === 'Sistem Yöneticisi' || (p?.position || '') === 'Firma Sahibi';
const tanimli = (p, positionModules, key) => {
  const ozel = p?.permissions?.modules?.[key];
  if (typeof ozel === 'boolean') return ozel;
  const poz = positionModules?.[p?.position]?.[key];
  if (typeof poz === 'boolean') return poz;
  const rut = positionModules?.[p?.rank]?.[key];
  if (typeof rut === 'boolean') return rut;
  return null;
};
export function modulErisimi(p, positionModules, key) {
  if (p?.employmentStatus === 'Pasif') return false;
  if (superAdminMi(p)) return true;
  return tanimli(p, positionModules, key) === true;
}
export function altSatisErisimi(p, positionModules, key) {
  if (!modulErisimi(p, positionModules, 'addJob')) return false;
  const t = tanimli(p, positionModules, key);
  return t === null ? true : t;
}
// "Bota geri ver" — devralan dışında yalnızca yöneticiler (App.jsx superYoneticiMi + isManager)
export const yoneticiMi = (p) => superAdminMi(p) || p?.rank === 'Müdür' || (p?.position || '').includes('Yönetici') || p?.permissions?.canEdit === true;

// { ok: true, personel } | { ok: false, kod: 401 | 403, hata, sebep }
export async function personelDogrula(db, appId, { personelId, sifre } = {}) {
  if (!personelId) return { ok: false, kod: 401, sebep: 'kimlik_yok', hata: 'Oturum bilgisi eksik. Lütfen yeniden giriş yapın.' };
  if (!sifre) return { ok: false, kod: 401, sebep: 'sifre_yok', hata: SIFRE_YOK_MESAJI };
  const kok = db.collection('artifacts').doc(appId).collection('public').doc('data');
  const s = await kok.collection('personnelList').doc(String(personelId)).get();
  const p = s.exists ? { id: String(personelId), ...s.data() } : null;
  if (!p) return { ok: false, kod: 401, sebep: 'personel_yok', hata: 'Oturum doğrulanamadı. Lütfen yeniden giriş yapın.' };
  if (!p.password) return { ok: false, kod: 401, sebep: 'sifre_yok', hata: SIFRE_YOK_MESAJI };
  if (String(p.password) !== String(sifre)) return { ok: false, kod: 401, sebep: 'sifre_hatali', hata: 'Oturum doğrulanamadı (şifre değişmiş olabilir). Lütfen yeniden giriş yapın.' };
  if (p.employmentStatus === 'Pasif' || p.permissions?.canView === false) return { ok: false, kod: 403, sebep: 'pasif', hata: 'Hesabınızın sisteme erişimi kapalı.' };
  const ayar = (await kok.collection('settings').doc('company').get()).data() || {};
  if (!altSatisErisimi(p, ayar.positionModules || {}, 'satisWhatsapp')) return { ok: false, kod: 403, sebep: 'yetki_yok', hata: 'WhatsApp paneli yetkiniz yok.' };
  return { ok: true, personel: p };
}
