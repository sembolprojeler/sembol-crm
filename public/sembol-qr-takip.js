/* ============================================================================
   SEMBOL CRM — QR TAKİP SİTE BETİĞİ  (sembol-qr-takip.js)  — SÜRÜM 3
   ----------------------------------------------------------------------------
   NEREYE: Her iki WordPress sitesinin (sembolevdeneve.com ve depoevim.com)
   <head> bölümüne, sihirbaz ve tıklama betiklerinden ÖNCE, EN ÜSTE
   (GeneratePress Elements → Hook → wp_head, öncelik 1, Entire Site):
     <script src="https://sembol-crm.vercel.app/sembol-qr-takip.js" data-no-optimize="1"></script>
   DİKKAT: Code Snippets'e PHP snippet olarak YAPIŞTIRILMAZ (PHP bu JS'i
   çalıştıramaz, snippet etkinleşmez).

   NE YAPAR (sihirbaz kodlarına DOKUNMADAN):
   1) Sayfa "?qr=<KOD>" veya "utm_source=qr&utm_campaign=<KOD>" ile açıldıysa
      izi hatırlar (localStorage, en fazla 30 gün).
   2) İlk görüntülemede CRM'e BİR KEZ "okutma" bildirir (api/qr-tarama.js).
   3) Siteden CRM API'sine giden HER isteğin (fetch, XMLHttpRequest/jQuery,
      sendBeacon) JSON gövdesine "qrIzi" nesnesini ekler.

   SÜRÜM 3 DÜZELTMESİ (kullanıcı bildirimi: "direkt girişleri ve Google
   girişlerini bile QR sayıyor"):
   • Eskiden QR izi 30 gün boyunca KOŞULSUZ saklanıyordu. QR'ı bir kez okutan
     telefon, sonraki günlerde siteye Google'dan ya da adres çubuğuna yazarak
     gelse bile her formu/tıklamayı QR'a bağlıyordu.
   • Artık siteye YENİ bir girişte (önceki sayfa sitenin kendisi değilse)
     adreste QR kodu YOKSA eski QR izi SİLİNİR — ziyaretçi bu sefer başka
     yoldan (Google, Facebook, direkt, başka site, reklam) gelmiş demektir.
     Site İÇİNDE sayfadan sayfaya geçerken iz korunur (QR → ana sayfa →
     teklif formu akışı bozulmaz). Bu, sihirbazların kendi kaynak mantığıyla
     (son giriş kaynağı geçerlidir) birebir aynı kural.
   ============================================================================ */
(function () {
  'use strict';
  if (window.__sembolQrTakip) return; // iki kez eklendiyse ikinciyi yok say
  window.__sembolQrTakip = 3;

  var CRM = 'https://sembol-crm.vercel.app';
  var ANAHTAR = 'sembol_qr_izi';
  var GUN_MS = 24 * 60 * 60 * 1000;
  var SAKLAMA_GUN = 30;
  var site = /depoevim\.com$/i.test(location.hostname) ? 'depoevim' : 'sembolevdeneve';
  var KENDI_ALAN = site === 'depoevim' ? 'depoevim.com' : 'sembolevdeneve.com';

  function oku() { try { var v = JSON.parse(localStorage.getItem(ANAHTAR) || 'null'); if (v && v.zamanMs && Date.now() - v.zamanMs < SAKLAMA_GUN * GUN_MS) return v; } catch (e) {} return null; }
  function yaz(v) { try { localStorage.setItem(ANAHTAR, JSON.stringify(v)); } catch (e) {} }
  function sil() { try { localStorage.removeItem(ANAHTAR); } catch (e) {} }

  // Önceki sayfa bu sitenin kendisi mi? (site içi gezinme)
  function siteIciGezinmeMi() {
    var ref = '';
    try { ref = document.referrer || ''; } catch (e) { ref = ''; }
    if (!ref) return false; // adres çubuğu / yer imi / uygulama / kamera → yeni giriş
    try { var h = new URL(ref).hostname.toLowerCase(); return h === KENDI_ALAN || h.slice(-(KENDI_ALAN.length + 1)) === '.' + KENDI_ALAN; } catch (e) { return false; }
  }

  // CRM API'si mi? Varsayılan Vercel adresi + "/api/submit-lead", "/api/yeni-musteri"
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

  // 1) Adresteki izi yakala — ya da yeni, QR'sız bir girişte eski izi sil
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
    } else if (!siteIciGezinmeMi()) {
      // YENİ (Sürüm 3): QR'sız yeni giriş → bu ziyaret QR'dan gelmedi.
      sil();
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