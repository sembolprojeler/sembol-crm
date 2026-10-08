// scripts/botBilgiSablonu.mjs
// ============================================================================
// Bot Bilgileri — örnek Word şablonu üretir: public/bot-bilgi-sablonu.docx
// Çalıştırma: node scripts/botBilgiSablonu.mjs (bölüm adları / ilk içerik değişince yeniden)
// Başlıklar Word'ün "Başlık 1" (Heading1) stilinde → sayfadaki içe aktarma bunları bölüm adı
// olarak tanır. İçerik: DepoEvim ilk içeriği (src/botBilgiSema.js) + SSS biçim örneği.
// jszip, mammoth'un bağımlılığıdır (ayrı paket eklenmedi).
// ============================================================================
import { writeFileSync } from 'node:fs';
import JSZip from 'jszip';
import { BOT_BILGI_BOLUMLERI, varsayilanBotBilgi } from '../src/botBilgiSema.js';

const xmlKacis = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const paragraf = (metin, stil = '') => `<w:p>${stil ? `<w:pPr><w:pStyle w:val="${stil}"/></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${xmlKacis(metin)}</w:t></w:r></w:p>`;

const ilk = varsayilanBotBilgi('depoevim');
const govde = [];
for (const b of BOT_BILGI_BOLUMLERI) {
  govde.push(paragraf(b.baslik, 'Heading1'));
  if (b.liste) {
    govde.push(paragraf('S: Depoma ne zaman gidebilirim?'));
    govde.push(paragraf('C: Kiralık depoya hafta içi randevu alarak gidebilirsiniz.'));
    govde.push(paragraf('S: Eşyalarım sigortalı mı?'));
    govde.push(paragraf('C: Evet, depodaki eşyalar sigortalıdır.'));
    continue;
  }
  const metin = ilk.bolumler[b.id] || '';
  // Boş bölüm yalnızca başlıkla gelir (yer tutucu metin içe aktarılınca içerik sanılmasın)
  if (metin) metin.split('\n').forEach(satir => govde.push(paragraf(satir)));
}

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const zip = new JSZip();
zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${W}><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style></w:styles>`);
zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W}><w:body>${govde.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`);

const cikti = new URL('../public/bot-bilgi-sablonu.docx', import.meta.url);
writeFileSync(cikti, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log('yazıldı:', cikti.pathname);
