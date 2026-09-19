import fs from 'fs';

/**
 * Mede onde o conteúdo realmente começa em cada página do PDF gerado.
 * A4 = 595,28 x 841,89 pt. Margem de 14mm = 39,7pt; topo de 22mm = 62,4pt.
 */
async function main() {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data: new Uint8Array(fs.readFileSync('./preview.pdf')) }).promise;

  const MM = 72 / 25.4;
  console.log(`esperado: esquerda >= ${(14 * MM).toFixed(1)}pt | direita <= ${(595.28 - 14 * MM).toFixed(1)}pt`);
  console.log(`          topo do conteudo <= ${(841.89 - 22 * MM).toFixed(1)}pt | base >= ${(16 * MM).toFixed(1)}pt\n`);

  for (let p = 1; p <= doc.numPages; p += 1) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const items = (tc.items as any[]).filter((i) => i.str.trim());
    if (!items.length) {
      console.log(`p${p}: sem texto`);
      continue;
    }
    const xs = items.map((i) => i.transform[4]);
    const ys = items.map((i) => i.transform[5]);
    const rights = items.map((i) => i.transform[4] + (i.width ?? 0));
    console.log(
      `p${p}: esquerda ${Math.min(...xs).toFixed(1)}pt | direita ${Math.max(...rights).toFixed(1)}pt | ` +
        `topo ${Math.max(...ys).toFixed(1)}pt | base ${Math.min(...ys).toFixed(1)}pt`,
    );
  }
  await doc.destroy();
}

main();
