import { BadRequestException } from '@nestjs/common';

/**
 * Extração do texto de um pedido em PDF, remontado linha a linha.
 *
 * Remontar importa: o pdfjs devolve os fragmentos na ordem em que o gerador do PDF os
 * escreveu, não na ordem visual, e o texto cru sai embaralhado — descrição, código e
 * quantidade misturados. Agrupando por coordenada Y e ordenando por X, cada linha da
 * tabela volta a ser uma linha de texto, que é o que o parser consegue ler.
 */

/** Fragmentos com Y a menos de 2pt de distância pertencem à mesma linha visual. */
const LINE_TOLERANCE_PT = 2;

type PdfTextItem = { str: string; transform: number[] };

export type ExtractedOrderText = {
  lines: string[];
  pageCount: number;
};

/**
 * Erro de negócio distinto: o PDF abriu, mas não tem texto nenhum — é uma imagem.
 * Vale a própria classe porque a saída para o usuário é diferente de "arquivo inválido":
 * aqui ele precisa preencher à mão, não trocar o arquivo.
 */
export class ScannedPdfError extends BadRequestException {
  constructor() {
    super(
      'Este PDF é uma imagem (foto ou digitalização), sem texto para ler. Preencha os dados do sistema manualmente.',
    );
  }
}

/** Agrupa os fragmentos de uma página em linhas visuais. */
export function groupItemsIntoLines(items: PdfTextItem[]): string[] {
  const rows = new Map<number, { x: number; text: string }[]>();

  for (const item of items) {
    if (!item.str.trim()) continue;
    // transform = [a, b, c, d, e, f]; e/f são a posição X/Y do fragmento na página.
    const x = item.transform[4];
    const y = Math.round(item.transform[5] / LINE_TOLERANCE_PT) * LINE_TOLERANCE_PT;

    const row = rows.get(y);
    if (row) {
      row.push({ x, text: item.str });
    } else {
      rows.set(y, [{ x, text: item.str }]);
    }
  }

  // Y cresce de baixo para cima no PDF, então a ordem de leitura é decrescente.
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, fragments]) =>
      fragments
        .sort((a, b) => a.x - b.x)
        .map((fragment) => fragment.text)
        .join(' ')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    )
    .filter((line) => line.length > 0);
}

export async function extractOrderText(buffer: Buffer): Promise<ExtractedOrderText> {
  // Import dinâmico: o pdfjs é ESM e só é carregado quando alguém envia um pedido,
  // mantendo-o fora do caminho de inicialização da função serverless.
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');

  let doc: Awaited<ReturnType<typeof getDocument>['promise']>;
  try {
    doc = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  } catch {
    throw new BadRequestException('Não foi possível abrir o PDF enviado. Verifique se o arquivo não está corrompido.');
  }

  const lines: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      lines.push(...groupItemsIntoLines(content.items as PdfTextItem[]));
    }
  } finally {
    await doc.destroy();
  }

  if (lines.length === 0) {
    throw new ScannedPdfError();
  }

  return { lines, pageCount: doc.numPages };
}
