/* ============================================================================
   SEMBOL CRM — QR TAKİP SİTE BETİĞİ  (sembol-qr-takip.js)  — SÜRÜM 2
   ----------------------------------------------------------------------------
   NEREYE: Her iki WordPress sitesinin (sembolevdeneve.com ve depoevim.com)
   <head> bölümüne, sihirbaz ve tıklama betiklerinden ÖNCE, EN ÜSTE:
     <script src="https://sembol-crm.vercel.app/sembol-qr-takip.js"></script>
   (CRM'den yüklenirse sonraki düzeltmeler siteye dokunmadan yayına çıkar.
   İstenirse eskisi gibi /wp-content/uploads/ altına kopyalanabilir.)

   NE YAPAR (sihirbaz kodlarına DOKUNMADAN):
   1) Sayfa "?qr=<KOD>" veya "utm_source=qr&utm_campaign=<KOD>" ile açıldıysa
      izi 30 gün boyunca hatırlar (localStorage).
   2) İlk görüntülemede CRM'e BİR KEZ "okutma" bildirir (api/qr-tarama.js).
   3) Siteden CRM API'sine giden HER isteğin (fetch, XMLHttpRequest/jQuery,
      sendBeacon) JSON gövdesine "qrIzi" nesnesini ekler.

   SÜRÜM 2 DÜZELTMELERİ (QR'dan gelen form "Organik" görünüyordu):
   • Okutma bildirimi sendBeacon + "application/json" Blob ile gidiyordu.
     Chrome bu türü sendBeacon'da REDDEDİYOR → okutma hiç kaydedilmiyordu
     (sayaç artmıyor, sunucu formu cihaz izinden de bağlayamıyordu). Artık
     "text/plain" gövdeli keepalive fetch kullanılıyor (ön-istek gerektirmez).
   • Sihirbaz XMLHttpRequest / jQuery.ajax ile gönderiyorsa iz eklenmiyordu —
     artık XHR da yakalanıyor.
   • fetch'e Request nesnesi / URL nesnesi verilirse ya da CRM farklı bir
     alan adından (özel domain) çağrılırsa iz eklenmiyordu — düzeltildi.
   ============================================================================ */
(function () {
  'use strict';
  if (window.__sembolQrTakip) return; // iki kez eklendiyse ikinciyi yok say
  window.__sembolQrTakip = 2;

  var CRM = 'https://sembol-crm.vercel.app';
  var ANAHTAR = 'sembol_qr_izi';
  var GUN_MS = 24 * 60 * 60 * 1000;
  var SAKLAMA_GUN = 30;
  var site = /depoevim\.com$/i.test(location.hostname) ? 'depoevim' : 'sembolevdeneve';

  function oku() { try { var v = JSON.parse(localStorage.getItem(ANAHTAR) || 'null'); if (v && v.zamanMs && Date.now() - v.zamanMs < SAKLAMA_GUN * GUN_MS) return v; } catch (e) {} return null; }
  function yaz(v) { try { localStorage.setItem(ANAHTAR, JSON.stringify(v)); } catch (e) {} }

  // CRM API'si mi? Varsayılan Vercel adresi + "/api/submit-lead", "/api/yeni-musteri"
  // gibi uçlar (CRM özel bir alan adına taşınsa da yakalansın diye).
  function urlMetni(url) { try { if (url && typeof url === 'object') return String(url.url || url.href || url); return String(url || ''); } catch (e) { return ''; } }
  function crmMi(url) {
    var u = urlMetni(url);
    return u.indexOf(CRM + '/api/') === 0 || /\/api\/(submit-lead|yeni-musteri)(\?|$)/.test(u);
  }

  // Okutma bildirimi — text/plain: CORS ön-isteği yok, Chrome'da sendBeacon kısıtı yok.
  function okutmaBildir(govde) {
    try {
      if (window.fetch) { fetch(CRM + '/api/qr-tarama', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: govde, keepalive: true, credentials: 'omit' }).catch(function () {}); return; }
    } catch (e) {}
    try { if (navigator.sendBeacon) navigator.sendBeacon(CRM + '/api/qr-tarama', govde); } catch (e) {}
  }

  // 1) Adresteki izi yakala
  try {
    var p = new URLSearchParams(location.search);
    var qr = p.get('qr') || ((p.get('utm_source') || '').toLowerCase() === 'qr' ? p.get('utm_campaign') : '');
    if (qr) {
      var iz = { qr: qr, utmSource: p.get('utm_source') || 'qr', utmMedium: p.get('utm_medium') || '', utmCampaign: p.get('utm_campaign') || qr, sayfaUrl: location.href, zaman: new Date().toISOString(), zamanMs: Date.now(), site: site };
      var onceki = oku();
      yaz(iz);
      // 2) Okutmayı bir kez bildir (aynı kod için 10 dk içinde tekrar bildirme)
      var yeniOkutma = !onceki || onceki.qr !== iz.qr || (Date.now() - onceki.zamanMs) > 10 * 60 * 1000;
      if (yeniOkutma) okutmaBildir(JSON.stringify({ kod: iz.qr, site: site, sayfaUrl: location.href }));
    }
  } catch (e) {}

  // 3) CRM'e giden isteklere izi ekle (yalnızca JSON metin gövdeler)
  function izEkle(body) {
    var iz = oku(); if (!iz || typeof body !== 'string') return body;
    try {
      var o = JSON.parse(body);
      if (o && typeof o === 'object' && !Array.isArray(o) && !o.qrIzi) { o.qrIzi = iz; o.sayfaUrl = o.sayfaUrl || location.href; return JSON.stringify(o); }
    } catch (e) {}
    return body;
  }

  // fetch
  var esFetch = window.fetch;
  if (esFetch) {
    window.fetch = function (girdi, opts) {
      try {
        if (crmMi(girdi) && oku()) {
          if (opts && typeof opts.body === 'string') {
            opts = Object.assign({}, opts, { body: izEkle(opts.body) });
          } else if (!opts && typeof Request !== 'undefined' && girdi instanceof Request && girdi.method === 'POST') {
            var istek = girdi;
            return istek.clone().text().then(function (t) {
              return esFetch.call(window, istek.url, { method: 'POST', headers: istek.headers, body: izEkle(t), credentials: istek.credentials, keepalive: istek.keepalive, mode: istek.mode });
            });
          }
        }
      } catch (e) {}
      return opts === undefined ? esFetch.call(window, girdi) : esFetch.call(window, girdi, opts);
    };
  }

  // XMLHttpRequest (jQuery.ajax dahil)
  if (window.XMLHttpRequest) {
    var XP = XMLHttpRequest.prototype, esOpen = XP.open, esSend = XP.send;
    XP.open = function (method, url) { try { this.__sembolCrm = crmMi(url); } catch (e) {} return esOpen.apply(this, arguments); };
    XP.send = function (body) { try { if (this.__sembolCrm && typeof body === 'string') body = izEkle(body); } catch (e) {} return esSend.call(this, body); };
  }

  // sendBeacon
  if (navigator.sendBeacon) {
    var esBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      try {
        if (crmMi(url) && oku()) {
          if (typeof data === 'string') return esBeacon(url, izEkle(data));
          if (data instanceof Blob) {
            // Blob senkron okunamaz — okuyup izi ekleyerek keepalive fetch ile gönder.
            data.text().then(function (t) {
              (esFetch || fetch).call(window, url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: izEkle(t), keepalive: true }).catch(function () {});
            });
            return true;
          }
        }
      } catch (e) {}
      return esBeacon(url, data);
    };
  }
})();
