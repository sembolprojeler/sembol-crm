// site-kodlari/depoevim-tiklama-takip-ref.js — ÜRETİLDİ (2026-10-10) referans/depoevim-tiklama-takip.js + WhatsApp ref kodu.
// Kurulum: sitedeki mevcut "depoevim-tiklama-takip" GeneratePress Hook'unun YERİNE (iki kez eklenmez).
// Test onayından önce siteye konmaz.
(function(){
  "use strict";

  var CLICK_CONFIG = {
    apiEndpoint: "https://sembol-crm.vercel.app/api/yeni-musteri",
    site: "depoevim",
    // YENİ (2026-10-10): sitedeki TÜM WhatsApp butonları bu numaraya gider (ülke koduyla, yalnızca rakam)
    whatsappNumarasi: "908504417886",
    refOnEk: "DE",
    varsayilanMesaj: "Merhaba, bilgi almak istiyorum."
  };

  // ===========================================================================
  // YENİ (2026-10-10): WHATSAPP REF KODU — bot konuşması ile bu tıklama kaydı AYNI lead olur.
  // Sitedeki her WhatsApp bağlantısı (wa.me / api.whatsapp.com) tıklanınca:
  //   1) numara CLICK_CONFIG.whatsappNumarasi'na çevrilir (butonda hangi numara yazılı olursa olsun)
  //   2) mesajın sonuna "(Ref: DE-XXXXXX)" eklenir — bot bu kodu müşteriye / yapay zekaya göstermez
  //   3) aynı kod tıklama bildirimiyle CRM'e gider (refKodu) → api/yeni-musteri.js "ref_<kod>" belgesi;
  //      bot müşterinin ilk mesajındaki kodla reklam kaynağını ve sayfa bilgisini bu belgeden alır.
  // Numara değişirse YALNIZCA CLICK_CONFIG.whatsappNumarasi değişir (ülke koduyla, yalnızca rakam: 908504417886 = 0850 441 78 86).
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


  // YENİ (Ali'nin gerçek reklam linkiyle bulduğu sorun): reklamlar müşteriyi
  // doğrudan fiyat teklifi sayfasına DEĞİL, ANA SAYFAYA düşürüyor
  // (örn. depoevim.com/?fbclid=...&utm_source=fb&utm_medium=paid). Müşteri
  // ana sayfadan "Fiyat Teklifi Al" sayfasına geçtiğinde tarayıcının adres
  // çubuğundaki bu parametreler KAYBOLUYOR — o sayfa kendi URL'sine baktığında
  // hiçbir işaret bulamıyor ve her şeyi "Organik" sayıyor.
  // ÇÖZÜM: Bu site-geneli script (her sayfada çalıştığı için) reklam işaretini
  // gördüğü AN localStorage'a kaydediyor; sonraki sayfalar (fiyat teklifi
  // sayfası dahil) kendi URL'sinde işaret bulamazsa bu kayıtlı değere bakıyor.
  // 30 gün geçerli — aynı gün içinde teklif vermese bile birkaç gün sonra
  // dönerse yine doğru kaynağa yazılır.
  var REKLAM_ATTR_ANAHTAR = "depoevim_reklam_kaynagi_v1";
  var REKLAM_ATTR_GECERLILIK_GUN = 30;
  var KENDI_SITE_PARCASI = "depoevim.com";

  // GÜNCELLEME (Ali'nin talebi, 2026-09): "organik" kategorisi 9 alt
  // kategoriye bölündü — google_ads, facebook_ads, facebook_organik,
  // instagram_ads, instagram_organik, google_anasayfa, google_altsayfa,
  // direkt_giris, diger_site. sembolevdeneve.com'daki fiyat teklifi
  // sihirbazlarındaki mantıkla BİREBİR aynı — aynı localStorage anahtarı
  // (yukarıda) her iki taraf da birbirinin kaydını okuyabilsin diye.

  // YENİ (2026-10): Yapay zeka platformu eşleme tablosu (sembolevdeneve.com ile aynı).
  // x.com / twitter TEK BAŞINA Grok sayılmaz. Yeni platform eklemek için satır eklemek yeter.
  var SNW_AI_PLATFORMLARI = [
    { kaynak: "chatgpt_organik",    alanlar: ["chatgpt.com", "chat.openai.com"],                 utm: ["chatgpt", "openai"] },
    { kaynak: "gemini_organik",     alanlar: ["gemini.google.com", "bard.google.com"],          utm: ["gemini", "bard"] },
    { kaynak: "claude_organik",     alanlar: ["claude.ai"],                                      utm: ["claude", "anthropic"] },
    { kaynak: "grok_organik",       alanlar: ["grok.com"],                                       utm: ["grok"] },
    { kaynak: "perplexity_organik", alanlar: ["perplexity.ai"],                                  utm: ["perplexity"] },
    { kaynak: "copilot_organik",    alanlar: ["copilot.microsoft.com", "copilot.cloud.microsoft"], utm: ["copilot"] }
  ];
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
  // YENİ (2026-10): Giriş anındaki ham pazarlama bilgisi
  function snwHamPazarlama(){
    var h = { utm_source: "", utm_medium: "", utm_campaign: "", utm_content: "", utm_term: "", referrer: "", landing_url: "" };
    try {
      var p = new URLSearchParams(location.search);
      ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"].forEach(function(k){
        var x = (p.get(k) || "").slice(0, 150);
        if (x.charAt(0) === "{") x = "";
        h[k] = x;
      });
    } catch (e) {}
    try { h.referrer = String(document.referrer || "").slice(0, 300); } catch (e) {}
    try { h.landing_url = String(location.origin + location.pathname + location.search).slice(0, 500); } catch (e) {}
    return h;
  }

  function anaSayfaMi(yol){
    var p = (yol || "/").toLowerCase();
    if (p === "/" || p === "" || p === "/index.php" || p === "/index.html" || p === "/home") return true;
    return false;
  }

  // Google reklamlarından mı geldi? (gclid parametresi ya da utm_source=google
  // + utm_medium=cpc) — sembolevdeneve.com'daki mevcut mantıkla aynı ayrım.
  // Instagram ve Facebook ayrı kategoriler: utm_source=instagram/facebook ile
  // ayırt ediliyor; sadece fbclid varsa (platform belirsizse) "facebook_ads"
  // sayılır (Ali'nin Meta Ads Manager'da her kampanyaya ayrı utm_source
  // eklemesi gerekiyor ki ikisi doğru şekilde ayrışsın).
  // Reklam işareti yoksa artık referrer'a bakıp organik trafiği de
  // google_anasayfa / google_altsayfa / facebook_organik / instagram_organik /
  // direkt_giris / diger_site olarak ayrıştırıyoruz.
  function urlKaynagiOku(){
    try {
      var params = new URLSearchParams(location.search);
      if (params.has("gclid")) return "google_ads";
      var utmSource = (params.get("utm_source") || "").toLowerCase();
      var utmMedium = (params.get("utm_medium") || "").toLowerCase();
      if (utmSource === "google") {
        if (utmMedium === "cpc" || utmMedium === "ppc") return "google_ads";
      }
      if (utmSource === "instagram" || utmSource === "ig") {
        if (utmMedium === "cpc" || utmMedium === "paid" || utmMedium === "paid_social" || utmMedium === "ads") return "instagram_ads";
      }
      if (utmSource === "facebook" || utmSource === "fb" || utmSource === "meta") {
        if (utmMedium === "cpc" || utmMedium === "paid" || utmMedium === "paid_social" || utmMedium === "ads") return "facebook_ads";
      }
      // YENİ (2026-10): ChatGPT reklamı / ChatGPT'nin kendi linkleri ve diğer yapay zekalar
      if (utmSource.indexOf("chatgpt") === 0 || utmSource === "openai") {
        if (utmMedium === "cpc" || utmMedium === "ppc" || utmMedium === "paid" || utmMedium === "ads") return "chatgpt_ads";
        return "chatgpt_organik";
      }
      var snwAiUtm = snwAiPlatformu(utmSource, "utm");
      if (snwAiUtm) return snwAiUtm;
      if (params.has("fbclid")) return "facebook_ads";
    } catch (e) { /* URLSearchParams desteklenmiyorsa reklam işareti yok say */ }

    // SADECE bu sayfanın kendi URL'sine bakar — aşağıdaki kaynakOku() önce
    // buna, bulamazsa (null dönerse) kayıtlı değere bakar.
    var ref = "";
    try { ref = document.referrer || ""; } catch (e) { ref = ""; }
    if (!ref) return "direkt_giris";

    var refHost = "";
    try { refHost = new URL(ref).hostname.toLowerCase(); } catch (e) { refHost = ""; }
    if (!refHost) return "direkt_giris";

    if (refHost.indexOf(KENDI_SITE_PARCASI) !== -1) {
      // Kendi sitemiz içinde bir sayfadan diğerine geçiş — bu sayfanın kendi
      // bir sinyali yok, daha önce kaydedilmiş asıl kaynağa güveniyoruz.
      return null;
    }

    // YENİ (2026-10): Yapay zeka asistanları (Google kontrolünden önce; gemini.google.com Google sayılmasın)
    var snwAiRef = snwAiPlatformu(refHost, "alan");
    if (snwAiRef) return snwAiRef;

    if (refHost === "google.com" || refHost.indexOf(".google.") !== -1 || refHost.indexOf("google.") === 0) {
      return anaSayfaMi(location.pathname) ? "google_anasayfa" : "google_altsayfa";
    }

    if (refHost.indexOf("facebook.com") !== -1 || refHost.indexOf("fb.com") !== -1) {
      return "facebook_organik";
    }

    if (refHost.indexOf("instagram.com") !== -1) {
      return "instagram_organik";
    }

    return "diger_site";
  }

  // Bu sayfada bir reklam/organik işareti varsa localStorage'a yazar —
  // sonraki sayfalar (fiyat teklifi sihirbazı dahil) bunu okuyabilsin diye.
  function reklamKaynagiKaydet(kaynak){
    try {
      if (kaynak) {
        localStorage.setItem(REKLAM_ATTR_ANAHTAR, JSON.stringify({ kaynak: kaynak, inisSayfasi: location.pathname || "/", pazarlama: snwHamPazarlama(), tarih: Date.now() })); // DEĞİŞTİ (2026-10): giriş sayfası + ham pazarlama bilgisi
      }
    } catch (e) { /* localStorage kapalıysa (gizli sekme vb.) sessizce geç */ }
  }

  // Önce BU SAYFANIN kendi URL'sine bakar (en güncel/güvenilir); yoksa daha
  // önceki bir sayfada kaydedilmiş değere bakar — o da yoksa/eskiyse
  // "direkt_giris" sayar.
  function kaynakOku(){
    var buSayfa = urlKaynagiOku();
    if (buSayfa) { reklamKaynagiKaydet(buSayfa); return buSayfa; }
    try {
      var kayitli = JSON.parse(localStorage.getItem(REKLAM_ATTR_ANAHTAR) || "null");
      if (kayitli) {
        if (kayitli.kaynak) {
          if ((Date.now() - kayitli.tarih) < REKLAM_ATTR_GECERLILIK_GUN * 24 * 60 * 60 * 1000) return kayitli.kaynak;
        }
      }
    } catch (e) { /* JSON bozuksa ya da localStorage kapalıysa direkt say */ }
    return "direkt_giris";
  }


  // YENİ (2026-10): PAZARLAMA İZİNİ CRM'E TAŞI — sihirbaz /api/submit-lead'e gönderirken
  // localStorage'daki ilk giriş bilgileri (utm_*, referrer, landing_url) gövdeye KÖK düzeyde
  // eklenir (sihirbazın gönderdiği alan varsa dokunulmaz). sembolevdeneve.com ile aynı mantık.
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

  function tiklamaBildir(kanalTipi, refKodu){
    try {
      var govde = {
        islem: "Ziyaretçi " + (kanalTipi === "whatsapp" ? "WhatsApp" : "Telefon") + " butonuna bastı",
        kaynak: kaynakOku(),
        site: CLICK_CONFIG.site
      };
      if (refKodu) govde.refKodu = refKodu; // YENİ (2026-10-10): WhatsApp ref kodu
      var payload = JSON.stringify(govde);
      payload = snwGovdeyiZenginlestir(payload); // YENİ (2026-10): tıklama bildirimine pazarlama izi
      if (navigator.sendBeacon) {
        var blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(CLICK_CONFIG.apiEndpoint, blob);
      } else {
        fetch(CLICK_CONFIG.apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true
        });
      }
    } catch (e) { /* bildirim başarısız olsa bile müşteri deneyimini ASLA bozmasın */ }
  }

  // Sayfa yüklenir yüklenmez (tıklama beklemeden) bu sayfada bir reklam/organik
  // işareti var mı diye bakıp varsa kaydediyoruz — böylece müşteri hiç
  // tıklamadan başka bir sayfaya (ör. fiyat teklifi sihirbazına) geçse bile
  // asıl giriş kaynağı kaybolmuyor.
  reklamKaynagiKaydet(urlKaynagiOku());

  // Sayfada SONRADAN JS ile eklenen linkleri de yakalamak için document
  // üzerinden "capture" fazında dinliyoruz — hangi elemente tıklanırsa
  // tıklansın, en yakın tel:/wa.me linkine bakıyoruz.
  document.addEventListener("click", function(e){
    var link = null;
    if (e.target) {
      if (e.target.closest) link = e.target.closest('a[href^="tel:"], a[href*="wa.me"], a[href*="api.whatsapp.com"]');
    }
    if (!link) return;
    var href = link.getAttribute("href") || "";
    var kanalTipi = /^tel:/i.test(href) ? "telefon" : "whatsapp";
    var refKodu = "";
    if (kanalTipi === "whatsapp" && snwWhatsappMi(href)) {
      // YENİ (2026-10-10): numara config'den + ref kodu; tarayıcı yeni bağlantıyı açar
      refKodu = snwRefKoduUret();
      link.setAttribute("href", snwWhatsappLinki(href, refKodu));
    }
    tiklamaBildir(kanalTipi, refKodu);
  }, true);
})();