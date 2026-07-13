import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Você é um assistente financeiro que narra, em português, um resumo já calculado das finanças do usuário.
Regras estritas:
- Use APENAS os números presentes no JSON fornecido. Nunca calcule, estime, recalcule ou corrija nenhum valor.
- Não invente proporções, percentuais ou comparações que não estejam explicitamente presentes no JSON.
- Se um campo vier como null, isso significa que não há dado suficiente para essa comparação — não a mencione.
- Não dê conselhos de investimento nem recomendações financeiras específicas, apenas descreva os números.
- Responda em 3 a 5 frases, tom claro e direto, formatando valores monetários como "R$ X,XX".`;

@Injectable()
export class AnthropicService {
  private readonly logger = new Logger(AnthropicService.name);

  constructor(private readonly configService: ConfigService) {}

  private getClient(): Anthropic | null {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY')?.trim();

    if (!apiKey) {
      return null;
    }

    return new Anthropic({ apiKey });
  }

  private getModel(): string {
    return this.configService.get<string>('ANTHROPIC_MODEL')?.trim() || 'claude-haiku-4-5-20251001';
  }

  async narrateFinancialSummary(aggregates: unknown): Promise<string | null> {
    const client = this.getClient();

    if (!client) {
      this.logger.warn('ANTHROPIC_API_KEY não configurada. Pulando geração de narrativa de insights.');
      return null;
    }

    try {
      const message = await client.messages.create({
        model: this.getModel(),
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Dados financeiros já calculados (não recalcule nada, apenas narre em texto corrido):\n${JSON.stringify(aggregates)}`,
          },
        ],
      });

      const textBlock = message.content.find((block) => block.type === 'text');
      return textBlock && 'text' in textBlock ? textBlock.text.trim() : null;
    } catch (err) {
      this.logger.error('Chamada à Anthropic falhou', (err as Error)?.stack || String(err));
      return null;
    }
  }
}
