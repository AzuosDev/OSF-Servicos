import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME = process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

/** Abre o PDF gerado no visualizador do Chrome e captura as páginas como elas saem. */
async function main() {
  const abs = path.resolve('./preview.pdf').split(path.sep).join('/');
  const file = 'file:///' + abs;

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 860, height: 1180, deviceScaleFactor: 2 });
  await page.goto(file, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 4000));

  await page.screenshot({ path: './real-p1.png' });
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('PageDown');
  }
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: './real-p2.png' });

  console.log('capturas do PDF real salvas');
  await browser.close();
}

main();
