import fs from 'fs';
async function main() {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data: new Uint8Array(fs.readFileSync('./preview.pdf')) }).promise;
  for (let p = 1; p <= doc.numPages; p += 1) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const items = (tc.items as any[]).filter((i) => i.str.trim());
    // Ordena por Y decrescente (topo primeiro), ignorando cabecalho/rodape da margem.
    const body = items.filter((i) => i.transform[5] < 790 && i.transform[5] > 50);
    body.sort((a, b) => b.transform[5] - a.transform[5]);
    const first = body.slice(0, 14).map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
    const last = body.slice(-8).map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
    console.log(`p${p} INICIO: ${first.slice(0, 95)}`);
    console.log(`p${p} FIM   : ${last.slice(0, 95)}\n`);
  }
  await doc.destroy();
}
main();
