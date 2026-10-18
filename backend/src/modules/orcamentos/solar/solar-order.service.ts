import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ParsedSolarOrder, parseSolarOrder } from './order-pdf-parser';
import { extractOrderText } from './order-pdf-text';

/**
 * Leitura de um pedido de distribuidora enviado pelo usuário.
 *
 * O resultado é sempre rascunho: este serviço nunca grava orçamento. Quem decide o que
 * entra é a tela de conferência, onde todo campo é editável. Isso não é cautela excessiva
 * — a quantidade vem de uma coluna cujo layout muda a cada fornecedor, e um número errado
 * aqui vira compromisso num documento que vai para o cliente.
 */

/** Teto do corpo da requisição na Vercel é ~4,5 MB; recusamos antes com mensagem clara. */
export const MAX_ORDER_PDF_BYTES = 4 * 1024 * 1024;

@Injectable()
export class SolarOrderService {
  private readonly logger = new Logger(SolarOrderService.name);

  async parseOrderPdf(buffer: Buffer): Promise<ParsedSolarOrder> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Arquivo vazio');
    }
    if (buffer.length > MAX_ORDER_PDF_BYTES) {
      throw new BadRequestException('O PDF do pedido precisa ter no máximo 4 MB');
    }

    const { lines, pageCount } = await extractOrderText(buffer);
    const parsed = parseSolarOrder(lines);

    this.logger.log(
      `Pedido lido: ${pageCount} página(s), ${lines.length} linhas, ${parsed.panels.length} painel(is), ` +
        `${parsed.inverters.length} inversor(es), ${parsed.warnings.length} aviso(s)`,
    );

    return parsed;
  }
}
