import { SolarInverterType } from '../schemas/solar-details.schema';

/**
 * Leitura das informações-chave de um pedido de distribuidora de sistema fotovoltaico.
 *
 * Genérico por vocabulário, não por distribuidora: procura os termos que o setor inteiro
 * usa (MÓDULO/PAINEL, INVERSOR/MICROINVERSOR, potência, total) em vez de decorar o layout
 * de cada fornecedor. Com 4 a 7 distribuidoras diferentes, um parser por layout viraria
 * manutenção sem fim.
 *
 * O resultado é sempre **rascunho para conferência**, nunca dado final: a quantidade fica
 * numa coluna separada e cada fornecedor a posiciona de um jeito, então ela é a informação
 * menos confiável daqui. O que não for reconhecido volta vazio para o usuário preencher.
 */

export type ParsedPanel = {
  quantity?: number;
  wattagePeak: number;
  model?: string;
  /** Linha original do pedido, para o usuário conferir de onde saiu o número. */
  sourceLine: string;
};

export type ParsedInverter = {
  quantity?: number;
  type: SolarInverterType;
  wattage?: number;
  model?: string;
  sourceLine: string;
};

export type ParsedSolarOrder = {
  panels: ParsedPanel[];
  inverters: ParsedInverter[];
  /** Valor do pedido, quando um total pôde ser identificado. */
  investment?: number;
  /** O que o usuário precisa conferir ou completar, em linguagem de usuário. */
  warnings: string[];
};

/**
 * Termos que aparecem em *acessórios* de montagem. Sem isso, "SUPORTE PARA FIXACAO DE
 * MICROINVERSOR" e "PERFIL FIXACAO MODULO FOTOV." entrariam como equipamento — os dois
 * casos são reais, saíram de um pedido de verdade.
 */
const ACCESSORY_TERMS = [
  'SUPORTE',
  'FIXACAO',
  'FIXAÇÃO',
  'PERFIL',
  'GRAMPO',
  'HASTE',
  'JUNCAO',
  'JUNÇÃO',
  'GARRA',
  'ATERRAMENTO',
  'CABO',
  'CONECTOR',
  'PARAFUSO',
  'ABRACADEIRA',
  'ABRAÇADEIRA',
  'TERMINAL',
  'DISJUNTOR',
  'STRING BOX',
  'STRINGBOX',
  'PROTECAO',
  'PROTEÇÃO',
  'ESTRUTURA',
  'TRILHO',
];

const PANEL_TERMS = ['MODULO', 'MÓDULO', 'MODULOS', 'MÓDULOS', 'PAINEL', 'PAINEIS', 'PAINÉIS', 'PLACA SOLAR'];

const MICROINVERTER_TERMS = ['MICROINVERSOR', 'MICRO INVERSOR', 'MICRO-INVERSOR'];

/**
 * Valor monetário. Três detalhes que vieram de pedidos reais:
 *
 * - `R$` é opcional: a Megatron escreve "TOTAL GERAL: 4.842,09", sem símbolo.
 * - Sem `R$`, o número precisa ter centavos (ver `looksLikeMoney`). Sem essa trava,
 *   "Total 124 $1,230.48" faria o total virar 124 — ali o 124 é a coluna de quantidade.
 * - O grupo aceita espaço antes dos centavos porque o PDF quebra o número em fragmentos e
 *   a remontagem devolve "R$ 1786, 47".
 */
const MONEY = String.raw`(R\$)?\s*([\d.,]+(?:\s+\d{2})?)`;

/** Número com duas casas decimais — a assinatura de um valor, não de uma quantidade. */
const looksLikeMoney = (raw: string) => /[.,]\s*\d{2}$/.test(raw.trim());

/**
 * Rótulos de total, do mais específico para o mais genérico. A ordem é a preferência:
 * o valor cheio do pedido vence o subtotal de produtos, que exclui frete.
 */
const TOTAL_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: 'Valor total', pattern: new RegExp(String.raw`VALOR\s+TOTAL[:\s]*${MONEY}`, 'i') },
  { label: 'Total a pagar', pattern: new RegExp(String.raw`TOTAL\s+A\s+PAGAR[:\s]*${MONEY}`, 'i') },
  { label: 'Total geral', pattern: new RegExp(String.raw`TOTAL\s+GERAL[:\s]*${MONEY}`, 'i') },
  { label: 'Valor do pedido', pattern: new RegExp(String.raw`VALOR\s+DO\s+PEDIDO[:\s]*${MONEY}`, 'i') },
  { label: 'Total do pedido', pattern: new RegExp(String.raw`TOTAL\s+DO\s+PEDIDO[:\s]*${MONEY}`, 'i') },
  { label: 'Total da nota', pattern: new RegExp(String.raw`TOTAL\s+DA\s+NOTA[:\s]*${MONEY}`, 'i') },
  { label: 'Total dos itens', pattern: new RegExp(String.raw`TOTAL\s+DOS\s+ITENS[:\s]*${MONEY}`, 'i') },
  { label: 'Total de produtos', pattern: new RegExp(String.raw`TOTAL\s+DE\s+PRODUTOS[:\s]*${MONEY}`, 'i') },
];

const normalize = (line: string) => line.toUpperCase().replace(/\s+/g, ' ').trim();

const containsAny = (haystack: string, terms: string[]) => terms.some((term) => haystack.includes(term));

/** Posição do primeiro termo encontrado, ou `Infinity` se nenhum aparecer. */
function firstIndexOfAny(haystack: string, terms: string[]): number {
  let first = Infinity;
  for (const term of terms) {
    const index = haystack.indexOf(term);
    if (index >= 0 && index < first) first = index;
  }
  return first;
}

/**
 * Decide se a linha é acessório de montagem comparando *qual termo vem primeiro*.
 *
 * Não basta procurar a palavra em qualquer lugar: a descrição de um painel de verdade
 * pode citar um acessório — "MODULO BIFACIAL 132 CEL. HJT 700W **CABO** 1.4M RISEN" é o
 * cabo que acompanha o módulo, e um teste de "contém CABO" descartaria o painel. O nome do
 * produto está no começo da linha, então vence o termo de menor índice: em "PERFIL FIXACAO
 * MODULO" o acessório vem antes e a linha é descartada; no módulo acima, não.
 */
function isAccessoryLine(line: string, equipmentTerms: string[]): boolean {
  return firstIndexOfAny(line, ACCESSORY_TERMS) < firstIndexOfAny(line, equipmentTerms);
}

/**
 * Converte número no formato brasileiro. "4.178,48" -> 4178.48, "1.234" -> 1234.
 * Formato americano ("2.25") também aparece em potência de inversor.
 */
export function parseBrazilianNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, '');
  if (!cleaned) return null;

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  let normalized: string;
  if (hasComma && hasDot) {
    // "4.178,48" — ponto é milhar, vírgula é decimal.
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.');
  } else if (hasDot) {
    // Ambíguo: "2.25" é decimal, "4.178" é milhar. Três dígitos depois do ponto e
    // nenhum outro separador significa milhar.
    normalized = /\.\d{3}$/.test(cleaned) ? cleaned.replace(/\./g, '') : cleaned;
  } else {
    normalized = cleaned;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Potência de painel: "700W", "550 Wp", "700 WP". Ignora tensão ("220V") e kV. */
function findPanelWattage(line: string): number | null {
  const matches = [...line.matchAll(/(\d{2,4})\s*WP?\b/gi)];

  for (const match of matches) {
    const value = Number(match[1]);
    // Faixa de módulo de mercado. Fora disso é outra coisa na descrição.
    if (value >= 100 && value <= 1500) return value;
  }
  return null;
}

/** Potência de inversor: "2.25KW" -> 2250 W, "6KW" -> 6000 W, "3000W" -> 3000 W. */
function findInverterWattage(line: string): number | null {
  const kw = line.match(/(\d+(?:[.,]\d+)?)\s*KW\b/i);
  if (kw) {
    const value = parseBrazilianNumber(kw[1]);
    if (value != null && value > 0 && value <= 500) return Math.round(value * 1000);
  }

  const w = [...line.matchAll(/(\d{3,6})\s*W\b/gi)];
  for (const match of w) {
    const value = Number(match[1]);
    if (value >= 300 && value <= 500000) return value;
  }
  return null;
}

/**
 * Quantidade da linha. É a informação menos confiável do pedido: fica numa coluna
 * separada, e o que chega aqui é a linha já remontada. Só aceita inteiro pequeno
 * isolado, e devolve `undefined` quando há ambiguidade — melhor o campo vir vazio do
 * que vir errado num documento que vai para o cliente.
 */
function findQuantity(line: string): number | undefined {
  // Formato com unidade explícita é o mais confiável: "4 UN", "1 PC", "2 PÇ".
  const withUnit = line.match(/\b(\d{1,4})\s*(?:UN|UND|UNID|PC|PCS|PÇ|PCT|PT)\b/i);
  if (withUnit) {
    const value = Number(withUnit[1]);
    if (value >= 1 && value <= 9999) return value;
  }

  // Senão, um inteiro isolado no fim da linha — layout de "descrição ... quantidade".
  const trailing = line.match(/(?:^|\s)(\d{1,4})\s*$/);
  if (trailing) {
    const value = Number(trailing[1]);
    if (value >= 1 && value <= 9999) return value;
  }

  return undefined;
}

/** Fabricante/modelo é ruidoso demais para adivinhar — fica a cargo do usuário. */
function findModel(line: string): string | undefined {
  const known = ['RISEN', 'GROWATT', 'CANADIAN', 'JINKO', 'TRINA', 'JA SOLAR', 'DEYE', 'HOYMILES', 'SOLIS', 'FRONIUS', 'BYD', 'LONGI'];
  const found = known.find((brand) => line.includes(brand));
  return found ? found.charAt(0) + found.slice(1).toLowerCase() : undefined;
}

/**
 * Lê as linhas já remontadas de um pedido. A remontagem por coordenada acontece antes,
 * na extração — aqui só entra texto linha a linha.
 */
export function parseSolarOrder(lines: string[]): ParsedSolarOrder {
  const panels: ParsedPanel[] = [];
  const inverters: ParsedInverter[] = [];
  const warnings: string[] = [];

  for (const rawLine of lines) {
    const line = normalize(rawLine);
    if (!line) continue;

    if (containsAny(line, MICROINVERTER_TERMS) && !isAccessoryLine(line, MICROINVERTER_TERMS)) {
      inverters.push({
        quantity: findQuantity(line),
        type: SolarInverterType.MICROINVERSOR,
        wattage: findInverterWattage(line) ?? undefined,
        model: findModel(line),
        sourceLine: rawLine.trim(),
      });
      continue;
    }

    if (line.includes('INVERSOR') && !isAccessoryLine(line, ['INVERSOR'])) {
      inverters.push({
        quantity: findQuantity(line),
        type: SolarInverterType.INVERSOR,
        wattage: findInverterWattage(line) ?? undefined,
        model: findModel(line),
        sourceLine: rawLine.trim(),
      });
      continue;
    }

    if (containsAny(line, PANEL_TERMS) && !isAccessoryLine(line, PANEL_TERMS)) {
      const wattagePeak = findPanelWattage(line);
      // Sem potência não dá para calcular geração nenhuma — a linha é descartada e o
      // usuário é avisado, em vez de entrar um painel de potência inventada.
      if (wattagePeak == null) {
        warnings.push(`Encontrei um painel sem potência reconhecível: "${rawLine.trim().slice(0, 80)}"`);
        continue;
      }
      panels.push({
        quantity: findQuantity(line),
        wattagePeak,
        model: findModel(line),
        sourceLine: rawLine.trim(),
      });
    }
  }

  const investment = findInvestment(lines);

  if (panels.length === 0) warnings.push('Nenhum painel solar foi reconhecido no pedido.');
  if (inverters.length === 0) warnings.push('Nenhum inversor ou microinversor foi reconhecido no pedido.');
  if (investment == null) warnings.push('O valor do pedido não foi reconhecido.');

  if (panels.some((panel) => panel.quantity == null) || inverters.some((inverter) => inverter.quantity == null)) {
    warnings.push('Não consegui ler a quantidade de algum equipamento — confira antes de continuar.');
  }

  return { panels, inverters, investment, warnings };
}

/**
 * Valor do pedido. Percorre os rótulos na ordem de preferência; o primeiro que casar
 * vence, porque "Valor total" é mais específico que "Total de produtos" (que exclui frete).
 */
export function findInvestment(lines: string[]): number | undefined {
  const joined = lines.map(normalize);

  for (const { pattern } of TOTAL_PATTERNS) {
    for (const line of joined) {
      const match = line.match(pattern);
      if (!match) continue;

      const [, currencySymbol, rawValue] = match;
      // Sem "R$" explícito, só aceita o que tem cara de dinheiro — senão uma coluna de
      // quantidade ao lado do rótulo viraria o valor do pedido.
      if (!currencySymbol && !looksLikeMoney(rawValue)) continue;

      const value = parseBrazilianNumber(rawValue);
      if (value != null && value > 0) return value;
    }
  }

  return undefined;
}
