import { findInvestment, parseBrazilianNumber, parseSolarOrder } from './order-pdf-parser';

/**
 * Linhas reais do pedido BelEnergy WEB-004464991. Esse PDF é imagem e não chega ao parser
 * por extração, mas o *conteúdo* é um pedido de verdade — e é a melhor fonte de casos de
 * borda que existe, incluindo os dois acessórios que citam "módulo" e "microinversor".
 */
const BELENERGY_LINES = [
  'COMPONENTES DO KIT',
  'MODULO BIFACIAL 132 CEL. HJT 700W CABO 1.4M RISEN Cód: MFRI-1.4-HJ-132-700W Fabricante: risen 4',
  'MICROINVERSOR DE CORRENTE MONOFASICO 4MPPT 220V 2.25KW GROWATT Cód: MINVGR-MO-220-2.25KW 1',
  'GARRA ATERRAMENTO 2 PECAS Cód: ATERRA2A Fabricante: BelEnergy 1',
  'GRAMPO FINAL 33MM 4 PECAS Cód: GRFN334A Fabricante: BelEnergy 1',
  'GRAMPO INTERMEDIARIO 2 PECAS Cód: GRINT2A Fabricante: BelEnergy 3',
  'HASTE SOLAR 10MM X 200MM 2 PECAS Cód: HASTE10X2002A 3',
  'JUNCAO PARA PERFIL 1 PECA Cód: JUNPERF1A Fabricante: BelEnergy 2',
  'PERFIL FIXACAO MODULO FOTOV. 31.9MM X 53.8MM X 2.70M ALUMINIO Cód: PERFIL2.70AL 4',
  'SUPORTE PE EM L FIBROCIMENTO 2 PECAS Cód: SUPL2A Fabricante: BelEnergy 3',
  'SUPORTE PARA FIXACAO DE MICROINVERSOR Cód: SUPMIN2A Fabricante: BelEnergy 1',
  'CABO SOLAR 4MM 0.6/1KV AC 1.8KV DC PRETO Cód: CBSOLBE-4MM-PT 8',
  'CONECTOR SOLAR FOTOVOLTAICO MACHO E FEMEA C/2 PARES Cód: CONECSOLAR 4',
  '+ Total de Produtos: R$ 3.578,48',
  '+ Valor do Frete: R$ 600,00',
  'Valor total: R$ 4.178,48',
];

describe('parseBrazilianNumber', () => {
  it('reads the Brazilian thousand/decimal format', () => {
    expect(parseBrazilianNumber('4.178,48')).toBe(4178.48);
    expect(parseBrazilianNumber('3.578,48')).toBe(3578.48);
    expect(parseBrazilianNumber('600,00')).toBe(600);
  });

  it('reads a plain integer', () => {
    expect(parseBrazilianNumber('4')).toBe(4);
  });

  // "2.25KW" vem em formato americano na descrição do inversor.
  it('treats a dot with fewer than three trailing digits as a decimal point', () => {
    expect(parseBrazilianNumber('2.25')).toBe(2.25);
  });

  it('treats a dot with exactly three trailing digits as a thousand separator', () => {
    expect(parseBrazilianNumber('4.178')).toBe(4178);
  });

  it('returns null for something that is not a number', () => {
    expect(parseBrazilianNumber('')).toBeNull();
    expect(parseBrazilianNumber('abc')).toBeNull();
  });
});

describe('findInvestment', () => {
  it('prefers the full order value over the products subtotal', () => {
    // 4.178,48 inclui o frete; 3.578,48 não.
    expect(findInvestment(BELENERGY_LINES)).toBe(4178.48);
  });

  it('falls back to TOTAL GERAL when there is no "Valor total"', () => {
    expect(findInvestment(['Peso: 356,30 Mercadoria: 4.842,10 TOTAL GERAL: 4.842,09'])).toBe(4842.09);
  });

  it('accepts the products subtotal when nothing better exists', () => {
    expect(findInvestment(['+ Total de Produtos: R$ 3.578,48'])).toBe(3578.48);
  });

  it('returns undefined when no total is present', () => {
    expect(findInvestment(['MODULO BIFACIAL 700W'])).toBeUndefined();
  });

  /**
   * Linhas reais, extraídas dos pedidos de outros fornecedores do usuário. Cada uma
   * quebrou o parser numa primeira versão.
   */
  describe('real lines from other distributors', () => {
    it('reads a value whose cents were split by a space during reconstruction', () => {
      // O PDF fragmenta o número e a remontagem devolve "R$ 1786, 47".
      expect(findInvestment(['Valor do pedido: R$ 1786, 47'])).toBe(1786.47);
    });

    it('reads "Total a Pagar"', () => {
      expect(findInvestment(['Total a Pagar: R$ 1.768,19'])).toBe(1768.19);
    });

    it('reads "Total dos Itens" written without a colon', () => {
      expect(findInvestment(['Total dos Itens R$ 276,21'])).toBe(276.21);
    });

    it('prefers the amount payable over a line item total', () => {
      const lines = ['Total do item: R$ 704', 'Total do item: R$ 939', 'Total a Pagar: R$ 1.768,19'];
      expect(findInvestment(lines)).toBe(1768.19);
    });

    // "Total 124 $1,230.48" — o 124 é a coluna de quantidade, não dinheiro.
    it('does not mistake a quantity column for the total', () => {
      expect(findInvestment(['Total 124 $1,230.48'])).toBeUndefined();
    });
  });
});

describe('parseSolarOrder', () => {
  const parsed = parseSolarOrder(BELENERGY_LINES);

  it('finds the panel with its wattage and quantity', () => {
    expect(parsed.panels).toHaveLength(1);
    expect(parsed.panels[0].wattagePeak).toBe(700);
    expect(parsed.panels[0].quantity).toBe(4);
    expect(parsed.panels[0].model).toBe('Risen');
  });

  it('finds the microinverter and converts kW to watts', () => {
    expect(parsed.inverters).toHaveLength(1);
    expect(parsed.inverters[0].type).toBe('MICROINVERSOR');
    expect(parsed.inverters[0].wattage).toBe(2250);
    expect(parsed.inverters[0].quantity).toBe(1);
    expect(parsed.inverters[0].model).toBe('Growatt');
  });

  it('reads the order value', () => {
    expect(parsed.investment).toBe(4178.48);
  });

  // Os dois casos reais que derrubariam um parser ingênuo.
  it('does not mistake "SUPORTE PARA FIXACAO DE MICROINVERSOR" for an inverter', () => {
    expect(parsed.inverters).toHaveLength(1);
    expect(parsed.inverters.map((i) => i.sourceLine).join(' ')).not.toContain('SUPORTE');
  });

  it('does not mistake "PERFIL FIXACAO MODULO FOTOV." for a panel', () => {
    expect(parsed.panels).toHaveLength(1);
    expect(parsed.panels.map((p) => p.sourceLine).join(' ')).not.toContain('PERFIL');
  });

  it('ignores cables, connectors, clamps and mounting hardware', () => {
    const everything = [...parsed.panels, ...parsed.inverters].map((e) => e.sourceLine).join(' ');
    for (const accessory of ['CABO SOLAR', 'CONECTOR', 'GRAMPO', 'HASTE', 'GARRA', 'JUNCAO']) {
      expect(everything).not.toContain(accessory);
    }
  });

  it('keeps the source line so the user can check where each number came from', () => {
    expect(parsed.panels[0].sourceLine).toContain('MODULO BIFACIAL');
  });

  it('warns about nothing when the order is fully recognised', () => {
    expect(parsed.warnings).toEqual([]);
  });

  describe('when information is missing', () => {
    it('warns and skips a panel with no recognisable wattage', () => {
      const result = parseSolarOrder(['MODULO FOTOVOLTAICO BIFACIAL RISEN 4']);

      expect(result.panels).toHaveLength(0);
      expect(result.warnings.some((w) => w.includes('sem potência'))).toBe(true);
    });

    it('warns when no panel is found', () => {
      const result = parseSolarOrder(['INVERSOR 5KW 1', 'Valor total: R$ 1.000,00']);
      expect(result.warnings).toContain('Nenhum painel solar foi reconhecido no pedido.');
    });

    it('warns when no inverter is found', () => {
      const result = parseSolarOrder(['MODULO 550W 10 UN', 'Valor total: R$ 1.000,00']);
      expect(result.warnings).toContain('Nenhum inversor ou microinversor foi reconhecido no pedido.');
    });

    it('warns when the order value is missing', () => {
      const result = parseSolarOrder(['MODULO 550W 10 UN', 'INVERSOR 5KW 1 UN']);
      expect(result.warnings).toContain('O valor do pedido não foi reconhecido.');
    });

    // Quantidade é a informação menos confiável: vir vazia é aceitável, vir errada não.
    it('leaves the quantity undefined and warns instead of guessing', () => {
      const result = parseSolarOrder(['MODULO BIFACIAL 700W RISEN cod ABC-700W']);

      expect(result.panels[0].quantity).toBeUndefined();
      expect(result.warnings.some((w) => w.includes('quantidade'))).toBe(true);
    });

    it('returns an empty draft for a document with nothing recognisable', () => {
      const result = parseSolarOrder(['Prezado cliente, segue em anexo.']);

      expect(result.panels).toEqual([]);
      expect(result.inverters).toEqual([]);
      expect(result.investment).toBeUndefined();
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('vocabulary variations across distributors', () => {
    it('recognises "PAINEL SOLAR" as well as "MODULO"', () => {
      const result = parseSolarOrder(['PAINEL SOLAR 550W JINKO 12 UN']);
      expect(result.panels[0].wattagePeak).toBe(550);
    });

    it('recognises an accented "MÓDULO"', () => {
      const result = parseSolarOrder(['MÓDULO FOTOVOLTAICO 585W 8 UN']);
      expect(result.panels[0].wattagePeak).toBe(585);
    });

    it('recognises "MICRO INVERSOR" written apart', () => {
      const result = parseSolarOrder(['MICRO INVERSOR 2KW HOYMILES 4 UN']);
      expect(result.inverters[0].type).toBe('MICROINVERSOR');
      expect(result.inverters[0].wattage).toBe(2000);
    });

    it('reads "Wp" as well as "W"', () => {
      const result = parseSolarOrder(['MODULO SOLAR 550 Wp 10 UN']);
      expect(result.panels[0].wattagePeak).toBe(550);
    });

    it('does not read a voltage as panel wattage', () => {
      // "220V" não pode virar potência.
      const result = parseSolarOrder(['MODULO 220V 450W 6 UN']);
      expect(result.panels[0].wattagePeak).toBe(450);
    });

    it('reads a quantity given with a unit', () => {
      expect(parseSolarOrder(['MODULO 550W 12 UN'])?.panels[0].quantity).toBe(12);
      expect(parseSolarOrder(['MODULO 550W 12 PC'])?.panels[0].quantity).toBe(12);
    });
  });
});
