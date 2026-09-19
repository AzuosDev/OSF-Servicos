import puppeteer from 'puppeteer-core';
import fs from 'fs';
import { buildBudgetHtml } from './src/modules/orcamentos/pdf/pdf-template';
import { PAGE_MARGIN, buildFooterTemplate, buildHeaderTemplate } from './src/modules/orcamentos/pdf/page-chrome';

const CHROME = process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const company: any = {
  companyName: 'OSF Serviços',
  cnpj: '35.156.797/0001-03',
  baseAddress: 'R. Manoel M. de Andrade, 42 - Junco, Sobral - CE',
  phone: '88 9688-6607',
  email: 'osfenergia.solucoes@gmail.com',
  instagram: '@osf_servicos',
  pdfFooterNote: 'Proposta sujeita a análise técnica no local.',
};
const client: any = { name: 'Otavo', address: 'Sobral' };
const budget: any = {
  sequenceNumber: 17,
  type: 'SOLAR',
  createdAt: new Date('2026-09-19T14:41:00.000Z'),
  validUntil: new Date('2026-09-26T00:00:00.000Z'),
  items: [],
  travelCost: 185.39,
  discount: 0,
  total: 8185.39,
  notes: 'teste teste teste teste teste teste teste teste teste teste teste teste teste teste teste teste',
  solar: {
    panels: [
      { quantity: 4, wattagePeak: 460, model: 'Trina 460W' },
      { quantity: 4, wattagePeak: 460, model: 'Canadian 400W' },
    ],
    inverters: [
      { quantity: 1, type: 'MICROINVERSOR', model: 'Growatt 2k', wattage: 2000 },
      { quantity: 1, type: 'INVERSOR', model: 'Deye 2k', wattage: 2000 },
    ],
    warranties: { panelEfficiencyYears: 25, panelDefectYears: 12, inverterYears: 10, installationYears: 5 },
    generation: {
      systemPowerKwp: 3.2,
      performanceRatio: 0.78,
      monthly: [
        { month: 1, kwh: 418 }, { month: 2, kwh: 356 }, { month: 3, kwh: 371 }, { month: 4, kwh: 344 },
        { month: 5, kwh: 387 }, { month: 6, kwh: 397 }, { month: 7, kwh: 433 }, { month: 8, kwh: 472 },
        { month: 9, kwh: 472 }, { month: 10, kwh: 480 }, { month: 11, kwh: 449 }, { month: 12, kwh: 441 },
      ],
      annualKwh: 5002,
      averageMonthlyKwh: 424,
      averageWeeklyKwh: 96,
      monthlyIrradiance: [5.4, 5.1, 4.8, 4.6, 5.0, 5.3, 5.6, 6.1, 6.3, 6.2, 6.0, 5.7],
    },
    financials: {
      investment: 8000,
      currentMonthlyBill: 1200,
      projectedMonthlyBill: 120,
      monthlySavings: 1080,
      annualSavings: 12960,
      horizonYears: 25,
      totalSavings: 324000,
      irrPercent: 162,
      paybackMonths: 8,
    },
  },
};

async function main() {
  const html = buildBudgetHtml(budget, client, company);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });

  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: buildHeaderTemplate(company, '0017'),
    footerTemplate: buildFooterTemplate(company),
    margin: { ...PAGE_MARGIN },
  });
  fs.writeFileSync('./preview.pdf', pdf);
  await browser.close();

  // Rasteriza as páginas REAIS do PDF, não uma simulação do HTML.
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data: new Uint8Array(fs.readFileSync('./preview.pdf')) }).promise;
  console.log('paginas:', doc.numPages);

  const viewer = await puppeteer.launch({ executablePath: CHROME, headless: true });
  for (let p = 1; p <= doc.numPages; p += 1) {
    const pg = await doc.getPage(p);
    const vp = pg.getViewport({ scale: 2 });
    const ops = await pg.getOperatorList();
    // Sem canvas nativo: medimos a caixa de conteúdo pelo bounding box dos desenhos.
    console.log(`  p${p}: ${vp.width.toFixed(0)}x${vp.height.toFixed(0)} | ${ops.fnArray.length} operacoes`);
  }
  await doc.destroy();
  await viewer.close();

  // Screenshot do HTML com a largura EXATA da caixa de conteudo, para inspecao visual.
  const b2 = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const p2 = await b2.newPage();
  const MM = 96 / 25.4;
  const W = Math.round(182 * MM);
  const H = Math.round(259 * MM);
  await p2.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await p2.setContent(html, { waitUntil: 'load' });
  const total = await p2.evaluate(() => document.body.scrollHeight);
  const sheets = Math.ceil(total / H);
  for (let i = 0; i < Math.min(sheets, 5); i += 1) {
    await p2.screenshot({ path: `./preview-p${i + 1}.png`, clip: { x: 0, y: i * H, width: W, height: H } });
  }
  console.log(`corpo: ${total}px -> ${sheets} folhas`);
  await b2.close();
}

main();
