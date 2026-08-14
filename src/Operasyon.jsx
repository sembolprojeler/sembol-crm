<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Önizleme — Tek Tarih + Saat Düzenleme</title><script src="https://cdn.tailwindcss.com"></script>
<style>body{background:#f5f5f5;font-family:system-ui,-apple-system,sans-serif}</style></head>
<body class="p-4 md:p-8 space-y-8 max-w-5xl mx-auto">

<h1 class="text-2xl font-black">📅 Önizleme: Tek Tarih + Saat Düzenleme</h1>

<!-- 1 -->
<section>
<h2 class="font-black text-lg mb-3">1️⃣ Filtre çubuğu — tek tarih + oklar, Giriş/Çıkış filtresi yok</h2>
<div class="bg-white rounded-2xl border shadow-sm p-4">
  <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
    <div class="md:col-span-2 flex items-stretch gap-1">
      <div class="px-3 flex items-center rounded-xl border bg-white text-neutral-600">‹</div>
      <div class="flex-1 p-2.5 border rounded-xl text-xs font-black text-center">14.08.2026</div>
      <div class="px-3 flex items-center rounded-xl border bg-white text-neutral-600">›</div>
    </div>
    <div class="p-2.5 border rounded-xl text-xs font-bold">Tüm Yakalar ⌄</div>
    <div class="p-2.5 border rounded-xl text-xs font-bold">Tüm Mesai Durumları ⌄</div>
  </div>
  <div class="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2">
    <div class="md:col-span-2 flex items-stretch gap-1">
      <div class="px-3 flex items-center rounded-xl border bg-white text-neutral-600">‹</div>
      <div class="flex-1 p-2.5 border rounded-xl text-xs font-black text-center">12.08.2026</div>
      <div class="px-3 flex items-center rounded-xl border bg-white text-neutral-600">›</div>
      <div class="px-3 flex items-center rounded-xl bg-black text-white text-[10px] font-black">BUGÜN</div>
    </div>
    <div class="p-2.5 border rounded-xl text-xs font-bold">Personel Seç (Tümü) ⌄</div>
  </div>
  <p class="text-[10px] font-bold text-neutral-500 mt-2">Sayfa her açılışta <b>bugünle</b> başlar. Oklarla gün değiştirirsiniz; bugünden farklı bir günde <b>BUGÜN</b> düğmesi belirir. "Giriş + Çıkış" filtresi kaldırıldı.</p>
</div>
</section>

<!-- 2 -->
<section>
<h2 class="font-black text-lg mb-3">2️⃣ Tablo — çöp kutusu yok, saat yanında kalem var</h2>
<div class="bg-white rounded-2xl border shadow-sm p-4 overflow-x-auto">
<table class="w-full text-left text-xs">
<thead><tr class="text-[10px] font-black text-neutral-400 uppercase border-b">
<th class="py-2 pr-3">PERSONEL</th><th class="py-2 pr-3">TARİH</th>
<th class="py-2 pr-3 bg-green-50 text-green-700">GİRİŞ</th><th class="py-2 pr-3 bg-red-50 text-red-700">ÇIKIŞ</th>
<th class="py-2 pr-3">MESAİ DURUMU</th><th class="py-2 pr-3">CİHAZ</th><th class="py-2 pr-3">BİRLİKTE</th></tr></thead>
<tbody>
<tr class="border-b">
  <td class="py-3 pr-3"><span class="text-xs font-black text-blue-600 underline">Alperen Demircan</span><p class="text-[9px] font-bold text-neutral-400">Taşıma Elemanı</p></td>
  <td class="py-3 pr-3 font-bold">14.08.2026</td>
  <td class="py-3 pr-3"><div><span class="text-xs font-black text-green-700 flex items-center gap-1.5">📷 08:05 <span class="text-neutral-300">✏️</span></span><p class="text-[9px] font-black text-emerald-700">📍 Haritada Gör</p></div></td>
  <td class="py-3 pr-3"><div><span class="text-xs font-black text-red-700 flex items-center gap-1.5">📷 17:06 <span class="text-neutral-300">✏️</span></span><p class="text-[9px] font-black text-emerald-700">📍 Haritada Gör</p></div></td>
  <td class="py-3 pr-3"><span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-100 text-green-700">Geldi</span></td>
  <td class="py-3 pr-3 font-bold text-neutral-500">Android</td>
  <td class="py-3 pr-3"><span class="text-[10px] font-black text-indigo-600 underline decoration-dotted">👥 4 kişi</span></td>
</tr>
<tr class="border-b bg-blue-50/30">
  <td class="py-3 pr-3"><span class="text-xs font-black text-blue-600 underline">Narıman Hudayberdiyev</span><p class="text-[9px] font-bold text-neutral-400">Taşıma Elemanı</p></td>
  <td class="py-3 pr-3 font-bold">14.08.2026</td>
  <td class="py-3 pr-3"><span class="text-xs font-bold text-neutral-300">—</span></td>
  <td class="py-3 pr-3"><div><span class="text-xs font-black text-red-700 flex items-center gap-1.5">⌨️ 18:00</span>
    <p class="text-[9px] font-black text-neutral-400 cursor-help" title="Eski saat: 17:11 • Düzenleyen: Mustafa Beşinci">✅ Düzenlendi</p>
    <p class="text-[9px] font-black text-emerald-700">📍 Haritada Gör</p></div></td>
  <td class="py-3 pr-3"><span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-100 text-green-700">Geldi</span></td>
  <td class="py-3 pr-3 font-bold text-neutral-500">Android</td>
  <td class="py-3 pr-3"><span class="text-[10px] font-black text-indigo-600 underline decoration-dotted">👥 6 kişi</span></td>
</tr>
</tbody></table>
</div>
<p class="text-[11px] font-bold text-neutral-500 mt-2">İkinci satır düzenlenmiş: kalem butonu kayboldu, yerine "✅ Düzenlendi" geldi. Üzerine gelince eski saati ve kimin düzelttiğini gösterir. <b>Çöp kutusu sütunu tamamen kaldırıldı</b> — hiçbir hareket silinemez.</p>
</section>

<!-- 3 -->
<section>
<h2 class="font-black text-lg mb-3">3️⃣ Kalem butonuna basınca</h2>
<div class="max-w-sm mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden border">
  <div class="p-4 bg-gradient-to-r from-red-600 to-rose-700 text-white flex justify-between items-center">
    <div><h3 class="font-black">🕐 Çıkış Saatini Düzenle</h3><p class="text-xs font-bold opacity-90">Narıman Hudayberdiyev • 14.08.2026</p></div>
    <span class="p-2 bg-white/20 rounded-full">✕</span>
  </div>
  <div class="p-4 space-y-3">
    <div class="bg-neutral-50 border rounded-xl p-3 text-[11px] font-bold text-neutral-600">
      QR ile basılan saat: <b class="text-black">17:11</b><span class="block mt-0.5">Yöntem: Seri kod (elle)</span>
    </div>
    <div><label class="block text-xs font-black text-neutral-600 uppercase mb-1.5">Yeni Çıkış Saati</label>
      <div class="w-full p-3 border-2 border-neutral-300 rounded-xl font-black text-center text-lg">18:00 🕐</div></div>
    <p class="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">⚠ Bu saat yalnızca BİR KEZ düzenlenebilir. Kaydettikten sonra kilitlenir ve "Düzenlendi" olarak işaretlenir.</p>
    <div class="flex gap-2">
      <span class="flex-1 py-3 rounded-xl bg-neutral-100 text-neutral-700 font-black text-sm text-center">Vazgeç</span>
      <span class="flex-1 py-3 rounded-xl bg-blue-600 text-white font-black text-sm text-center">💾 Kaydet ve Kilitle</span>
    </div>
  </div>
</div>
</section>

<section class="bg-green-50 border border-green-200 rounded-2xl p-5">
<h2 class="font-black text-sm text-green-900 mb-2">✅ Test edilenler</h2>
<table class="w-full text-[11px] font-bold text-green-800">
<tr class="border-b border-green-200"><td class="py-1.5">Açılış tarihi</td><td class="text-right">Her zaman bugün</td></tr>
<tr class="border-b border-green-200"><td class="py-1.5">Sol/sağ ok</td><td class="text-right">±1 gün, doğru çalışıyor</td></tr>
<tr class="border-b border-green-200"><td class="py-1.5">1. saat düzenlemesi (17:11→18:00)</td><td class="text-right">Kaydedildi, eski saat saklandı</td></tr>
<tr class="border-b border-green-200"><td class="py-1.5">2. düzenleme denemesi</td><td class="text-right">Reddedildi (kilitli)</td></tr>
<tr><td class="py-1.5">Geçersiz saatler (25:00, 12:60, 8:30)</td><td class="text-right">Reddedilir</td></tr>
</table>
</section>

</body></html>
