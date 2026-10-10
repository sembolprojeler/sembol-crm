// site-kodlari/sembol-tiklama-takip-ref.js — ÜRETİLDİ (2026-10-10) referans/sembol-tiklama-takip.js + WhatsApp ref kodu.
// Kurulum: sitedeki mevcut "sembol-tiklama-takip" GeneratePress Hook'unun YERİNE (iki kez eklenmez).
// Test onayından önce siteye konmaz.
(function(){
  "use strict";

  var CLICK_CONFIG = {
    apiEndpoint: "https://sembol-crm.vercel.app/api/yeni-musteri",
    site: "sembolevdeneve",
    // YENİ (2026-10-10): sitedeki TÜM WhatsApp butonları bu numaraya gider (ülke koduyla, yalnızca rakam)
    whatsappNumarasi: "902163908999",
    refOnEk: "SB",
    varsayilanMesaj: "Merhaba, bilgi almak istiyorum."
  };

  // ===========================================================================
  // YENİ (2026-10-10): WHATSAPP REF KODU — bot konuşması ile bu tıklama kaydı AYNI lead olur.
  // Sitedeki her WhatsApp bağlantısı (wa.me / api.whatsapp.com) tıklanınca:
  //   1) numara CLICK_CONFIG.whatsappNumarasi'na çevrilir (butonda hangi numara yazılı olursa olsun)
  //   2) mesajın sonuna "(Ref: SB-XXXXXX)" eklenir — bot bu kodu müşteriye / yapay zekaya göstermez
  //   3) aynı kod tıklama bildirimiyle CRM'e gider (refKodu) → api/yeni-musteri.js "ref_<kod>" belgesi;
  //      bot müşterinin ilk mesajındaki kodla reklam kaynağını ve sayfa bilgisini bu belgeden alır.
  // Numara değişirse YALNIZCA CLICK_CONFIG.whatsappNumarasi değişir (ülke koduyla, yalnızca rakam: 902163908999 = 0216 390 89 99).
  // ===========================================================================
  function snwRefKoduUret(){
    var harfler = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = "", r = null;
    try { if (window.crypto && window.crypto.getRandomValues) r = window.crypto.getRandomValues(new Uint8Array(6)); } catch (e) {}
    for (var i = 0; i < 6; i++) s += harfler.charAt((r ? r[i] : Math.floor(Math.random() * 256)) % harfler.length);
    return CLICK_CONFIG.refOnEk + "-" + s;
  }
  function snwWhatsappMi(href){
    return /^https?:\/\/(wa\.me|api\.whatsapp\.com|(www\.)?whatsapp\.com|web\.whatsapp\.com)\//i.test(String(href || "")) || /^whatsapp:/i.test(String(href || ""));
  }
  function snwWhatsappLinki(href, refKodu){
    var metin = "";
    try { metin = new URL(href, location.href).searchParams.get("text") || ""; } catch (e) {}
    metin = metin.replace(/\s*\(?\s*Ref\s*:\s*(SB|DE)-[A-Z0-9]{4,10}\s*\)?/gi, "").trim() || CLICK_CONFIG.varsayilanMesaj;
    return "https://wa.me/" + CLICK_CONFIG.whatsappNumarasi + "?text=" + encodeURIComponent(metin + " (Ref: " + refKodu + ")");
  }


  // GÜNCELLEME (Ali'nin talebi, 2026-09): Eskiden sadece "organik" ve
  // "google_ads" ayrımı vardı (referrer içinde "google" geçiyorsa google_ads
  // sayılıyordu — bu, Google'dan organik gelen ziyaretçiyi de yanlışlıkla
  // google_ads sayıyordu). Şimdi 9 kategoriye ayrıldı: google_ads,
  // facebook_ads, facebook_organik, instagram_ads, instagram_organik,
  // google_anasayfa, google_altsayfa, direkt_giris, diger_site — fiyat
  // teklifi sihirbazlarındaki (sembol-evden-eve-nakliyat-teklifi-guncel.txt
  // vb.) mantıkla BİREBİR aynı, AYNI localStorage anahtarı kullanılır ki
  // sihirbaz ve site-geneli tıklama takibi birbirinin kaydını okuyabilsin.
  //
  // NEREYE EKLENİR (değişmedi): Bu kod SİTE GENELİNDE her sayfada çalışması
  // gereken bir GeneratePress Elements "Hook" (wp_footer, Entire Site).
  var REKLAM_ATTR_ANAHTAR = "sembol_reklam_kaynagi_v1";
  var REKLAM_ATTR_GECERLILIK_GUN = 30;
  var KENDI_SITE_PARCASI = "sembolevdeneve.com";

  // YENİ (2026-10): Yapay zeka platformu eşleme tablosu (alan adı ya da utm_source parçası).
  // x.com / twitter TEK BAŞINA Grok sayılmaz. Yeni platform eklemek için satır eklemek yeter.
  var SNW_AI_PLATFORMLARI = [
    { kaynak: "chatgpt_organik",    alanlar: ["chatgpt.com", "chat.openai.com"],                 utm: ["chatgpt", "openai"] },
    { kaynak: "gemini_organik",     alanlar: ["gemini.google.com", "bard.google.com"],          utm: ["gemini", "bard"] },
    { kaynak: "claude_organik",     alanlar: ["claude.ai"],                                      utm: ["claude", "anthropic"] },
    { kaynak: "grok_organik",       alanlar: ["grok.com"],                                       utm: ["grok"] },
    { kaynak: "perplexity_organik", alanlar: ["perplexity.ai"],                                  utm: ["perplexity"] },
    { kaynak: "copilot_organik",    alanlar: ["copilot.microsoft.com", "copilot.cloud.microsoft"], utm: ["copilot"] }
  ];
  // tur: "alan" → referrer alan adı (tam eşleşme ya da alt alan adı), "utm" → utm_source başı
  function snwAiPlatformu(deger, tur){
    var d = String(deger || "").toLowerCase();
    if (!d) return null;
    for (var i = 0; i < SNW_AI_PLATFORMLARI.length; i++) {
      var p = SNW_AI_PLATFORMLARI[i];
      var liste = tur === "utm" ? p.utm : p.alanlar;
      for (var j = 0; j < liste.length; j++) {
        var x = liste[j];
        if (tur === "utm") { if (d.indexOf(x) === 0) return p.kaynak; }
        else if (d === x || d.slice(-(x.length + 1)) === "." + x) return p.kaynak;
      }
    }
    return null;
  }
  // YENİ (2026-10): Giriş anındaki ham pazarlama bilgisi (CRM kendi sınıflandırmasını da yapabilsin)
  function snwHamPazarlama(){
    var h = { utm_source: "", utm_medium: "", utm_campaign: "", utm_content: "", utm_term: "", referrer: "", landing_url: "" };
    try {
      var p = new URLSearchParams(location.search);
      ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"].forEach(function(k){
        var x = (p.get(k) || "").slice(0, 150);
        if (x.charAt(0) === "{") x = ""; // doldurulmamış yer tutucu, ör. {campaign_id}
        h[k] = x;
      });
    } catch (e) {}
    try { h.referrer = String(document.referrer || "").slice(0, 300); } catch (e) {}
    try { h.landing_url = String(location.origin + location.pathname + location.search).slice(0, 500); } catch (e) {}
    return h;
  }

  function snwAnaSayfaMi(yol){
    var p = (yol || "/").toLowerCase();
    if (p === "/" || p === "" || p === "/index.php" || p === "/index.html" || p === "/home") return true;
    return false;
  }

  function snwBuSayfaninKaynagi(){
    try {
      var params = new URLSearchParams(location.search);
      if (params.has("gclid")) return { kaynak: "google_ads" };
      var utmSource = (params.get("utm_source") || "").toLowerCase();
      var utmMedium = (params.get("utm_medium") || "").toLowerCase();
      if (utmSource === "google") {
        if (utmMedium === "cpc" || utmMedium === "ppc") return { kaynak: "google_ads" };
      }
      if (utmSource === "instagram" || utmSource === "ig") {
        if (utmMedium === "cpc" || utmMedium === "paid" || utmMedium === "paid_social" || utmMedium === "ads") return { kaynak: "instagram_ads" };
      }
      if (utmSource === "facebook" || utmSource === "fb" || utmSource === "meta") {
        if (utmMedium === "cpc" || utmMedium === "paid" || utmMedium === "paid_social" || utmMedium === "ads") return { kaynak: "facebook_ads" };
      }
      // YENİ (2026-10): Yapay zeka asistanları — ChatGPT reklamı (utm_medium cpc/paid/ads) ve
      // ChatGPT'nin kendi linkleri (utm_source=chatgpt.com, medium'suz) ayrı sayılır.
      if (utmSource.indexOf("chatgpt") === 0 || utmSource === "openai") {
        if (utmMedium === "cpc" || utmMedium === "ppc" || utmMedium === "paid" || utmMedium === "ads") return { kaynak: "chatgpt_ads" };
        return { kaynak: "chatgpt_organik" };
      }
      var snwAiUtm = snwAiPlatformu(utmSource, "utm");
      if (snwAiUtm) return { kaynak: snwAiUtm };
      if (params.has("fbclid")) return { kaynak: "facebook_ads" };
    } catch (e) { /* URLSearchParams desteklenmiyorsa reklam işareti yok say */ }

    var ref = "";
    try { ref = document.referrer || ""; } catch (e) { ref = ""; }
    if (!ref) return { kaynak: "direkt_giris" };

    var refHost = "";
    try { refHost = new URL(ref).hostname.toLowerCase(); } catch (e) { refHost = ""; }
    if (!refHost) return { kaynak: "direkt_giris" };

    if (refHost.indexOf(KENDI_SITE_PARCASI) !== -1) {
      // Kendi sitemiz içinde bir sayfadan diğerine geçiş — bu sayfanın kendi
      // bir sinyali yok, daha önce kaydedilmiş asıl kaynağa güveniyoruz.
      return null;
    }

    // YENİ (2026-10): Yapay zeka asistanlarından gelenler (Google kontrolünden önce)
    var snwAiRef = snwAiPlatformu(refHost, "alan");
    if (snwAiRef) return { kaynak: snwAiRef };

    if (refHost === "google.com" || refHost.indexOf(".google.") !== -1 || refHost.indexOf("google.") === 0) {
      return { kaynak: snwAnaSayfaMi(location.pathname) ? "google_anasayfa" : "google_altsayfa" };
    }

    if (refHost.indexOf("facebook.com") !== -1 || refHost.indexOf("fb.com") !== -1) {
      return { kaynak: "facebook_organik" };
    }
    if (refHost.indexOf("instagram.com") !== -1) {
      return { kaynak: "instagram_organik" };
    }

    return { kaynak: "diger_site", digerSiteAdi: refHost };
  }

  function snwKaynakKaydet(sonuc){
    try {
      if (sonuc) {
        if (sonuc.kaynak) {
          localStorage.setItem(REKLAM_ATTR_ANAHTAR, JSON.stringify({
            kaynak: sonuc.kaynak,
            digerSiteAdi: sonuc.digerSiteAdi || "",
            inisSayfasi: location.pathname || "/",
            pazarlama: snwHamPazarlama(), // YENİ (2026-10)
            tarih: Date.now()
          }));
        }
      }
    } catch (e) { /* localStorage kapalıysa (gizli sekme vb.) sessizce geç */ }
  }

  function snwKaynakOkuTam(){
    var buSayfa = snwBuSayfaninKaynagi();
    if (buSayfa) {
      snwKaynakKaydet(buSayfa);
      return { kaynak: buSayfa.kaynak, digerSiteAdi: buSayfa.digerSiteAdi || "", inisSayfasi: location.pathname || "/" };
    }
    try {
      var kayitli = JSON.parse(localStorage.getItem(REKLAM_ATTR_ANAHTAR) || "null");
      if (kayitli) {
        if (kayitli.kaynak) {
          if ((Date.now() - kayitli.tarih) < REKLAM_ATTR_GECERLILIK_GUN * 24 * 60 * 60 * 1000) {
            return { kaynak: kayitli.kaynak, digerSiteAdi: kayitli.digerSiteAdi || "", inisSayfasi: kayitli.inisSayfasi || "" };
          }
        }
      }
    } catch (e) { /* JSON bozuksa ya da localStorage kapalıysa direkt say */ }
    return { kaynak: "direkt_giris", digerSiteAdi: "", inisSayfasi: location.pathname || "/" };
  }

  // Doğrudan Vercel API'ye (api/yeni-musteri.js) haber uçuran fonksiyon
  function gonderCrm(kaynak, islem, detay, refKodu) {
    var govde = {
      kaynak: kaynak,
      islem: islem,
      detay: detay,
      site: CLICK_CONFIG.site,
      zaman: new Date().toISOString()
    };
    if (refKodu) govde.refKodu = refKodu; // YENİ (2026-10-10): WhatsApp ref kodu
    var payload = JSON.stringify(govde);
    // YENİ (2026-10): tıklama bildirimine de pazarlama izi
    payload = snwGovdeyiZenginlestir(payload);
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(CLICK_CONFIG.apiEndpoint, blob);
        return;
      }
    } catch (e) { /* sendBeacon başarısızsa fetch'e düş */ }
    fetch(CLICK_CONFIG.apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true
    }).catch(function(err) { console.log("CRM Hatası:", err); });
  }

  // Sayfa yüklenir yüklenmez (tıklama beklemeden) bu sayfanın kaynağını
  // hesaplayıp gerekiyorsa localStorage'a kaydediyoruz — böylece müşteri
  // hiç tıklamadan başka bir sayfaya (ör. fiyat teklifi sihirbazına) geçse
  // bile asıl giriş kaynağı kaybolmuyor.
  snwKaynakOkuTam();


  // YENİ (2026-10): PAZARLAMA İZİNİ CRM'E TAŞI — sihirbazlar /api/submit-lead'e gönderirken
  // localStorage'daki ilk giriş bilgileri (utm_*, referrer, landing_url) gövdeye KÖK düzeyde
  // eklenir (sihirbazın kendi gönderdiği alan varsa ona dokunulmaz). Böylece sihirbaz kodlarını
  // tek tek değiştirmeden tüm teklif formları kampanya/giriş sayfası bilgisini gönderir.
  // Yalnızca fetch ile giden gövdeler (form tamamlama dahil) zenginleşir; sayfadan ayrılırken
  // sendBeacon ile giden ara kayıtlar olduğu gibi kalır (sunucu önceki izi zaten korur).
  function snwPazarlamaAlanlari(){
    try {
      var k = JSON.parse(localStorage.getItem(REKLAM_ATTR_ANAHTAR) || "null");
      if (k && k.pazarlama && (Date.now() - k.tarih) < REKLAM_ATTR_GECERLILIK_GUN * 24 * 60 * 60 * 1000) return k.pazarlama;
    } catch (e) {}
    return null;
  }
  function snwGovdeyiZenginlestir(govde){
    var pz = snwPazarlamaAlanlari();
    if (!pz || typeof govde !== "string") return govde;
    try {
      var o = JSON.parse(govde);
      if (!o || typeof o !== "object" || Array.isArray(o)) return govde;
      ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","referrer","landing_url"].forEach(function(a){
        if (pz[a] && !o[a]) o[a] = pz[a];
      });
      return JSON.stringify(o);
    } catch (e) { return govde; }
  }
  if (window.fetch && !window.__snwFetchSarildi) {
    window.__snwFetchSarildi = true;
    var snwAsilFetch = window.fetch;
    window.fetch = function(adres, ayar){
      try {
        var u = typeof adres === "string" ? adres : (adres && adres.url) || "";
        if (u.indexOf("/api/submit-lead") !== -1 && ayar && typeof ayar.body === "string") {
          ayar = Object.assign({}, ayar, { body: snwGovdeyiZenginlestir(ayar.body) });
        }
      } catch (e) {}
      return snwAsilFetch.call(this, adres, ayar);
    };
  }

  document.addEventListener('click', function (e) {
    // Sitede tıklanan herhangi bir bağlantıyı (<a>) bul
    var link = e.target.closest ? e.target.closest('a') : null;
    if (!link) return;

    var href = link.getAttribute('href') || '';
    var kaynak = snwKaynakOkuTam().kaynak;
    var islem = '';

    // BURASI EN ÖNEMLİ KISIM: Sınıf adına (class) bakmadan, içinde tel: veya wa.me geçen HER ŞEYİ yakala!
    if (href.indexOf('tel:') === 0) {
      islem = 'Telefon Araması';
      gonderCrm(kaynak, islem, href.replace('tel:', ''));
    } else if (snwWhatsappMi(href)) {
      // YENİ (2026-10-10): numara config'den + ref kodu; tarayıcı yeni bağlantıyı açar
      var refKodu = snwRefKoduUret();
      var yeniHref = snwWhatsappLinki(href, refKodu);
      link.setAttribute('href', yeniHref);
      islem = 'WhatsApp Mesajı';
      gonderCrm(kaynak, islem, yeniHref, refKodu);
    }
  }, true);
})();