import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BudgetsService } from './budgets.service';
import { Budget, BudgetStatus } from './schemas/budget.schema';
import { ClientsService } from './clients.service';
import { CompanySettingsService } from './company-settings.service';
import { CountersService } from './counters.service';
import { DistanceService } from './distance.service';
import { ServicesService } from '../services/services.service';
import { SolarIrradianceService } from './solar/solar-irradiance.service';

describe('BudgetsService', () => {
  let service: BudgetsService;
  let budgetModelMock: { create: jest.Mock; findOne: jest.Mock };
  let clientsServiceMock: { findOne: jest.Mock };
  let companySettingsServiceMock: { get: jest.Mock };
  let countersServiceMock: { getNextSequence: jest.Mock };
  let distanceServiceMock: { calculate: jest.Mock; locate: jest.Mock };
  let servicesServiceMock: { findOne: jest.Mock };
  let solarIrradianceServiceMock: { getMonthlyIrradiance: jest.Mock };

  const userId = new Types.ObjectId().toString();
  const client = { _id: new Types.ObjectId(), address: 'Rua Cliente, 100' };
  const companySettings = { baseAddress: 'Rua Empresa, 1', pricePerKm: 2, minimumTravelFee: 20, freeRadiusKm: 5 };

  beforeEach(async () => {
    budgetModelMock = { create: jest.fn((doc) => Promise.resolve(doc)), findOne: jest.fn() };
    clientsServiceMock = { findOne: jest.fn().mockResolvedValue(client) };
    companySettingsServiceMock = { get: jest.fn().mockResolvedValue(companySettings) };
    countersServiceMock = { getNextSequence: jest.fn().mockResolvedValue(1) };
    distanceServiceMock = { calculate: jest.fn(), locate: jest.fn() };
    solarIrradianceServiceMock = { getMonthlyIrradiance: jest.fn() };
    servicesServiceMock = {
      findOne: jest.fn().mockResolvedValue({ _id: new Types.ObjectId(), name: 'Instalação de painel', defaultValue: 500 }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BudgetsService,
        { provide: getModelToken(Budget.name), useValue: budgetModelMock },
        { provide: ClientsService, useValue: clientsServiceMock },
        { provide: CompanySettingsService, useValue: companySettingsServiceMock },
        { provide: CountersService, useValue: countersServiceMock },
        { provide: DistanceService, useValue: distanceServiceMock },
        { provide: ServicesService, useValue: servicesServiceMock },
        { provide: SolarIrradianceService, useValue: solarIrradianceServiceMock },
      ],
    }).compile();

    service = moduleRef.get(BudgetsService);
  });

  it('snapshots service name/price at creation and respects a manual override', async () => {
    const budget = await service.create(userId, {
      clientId: client._id.toString(),
      items: [
        { serviceId: 'svc1', quantity: 2 },
        { serviceId: 'svc2', quantity: 1, unitPriceOverride: 999 },
      ],
    } as any);

    expect(budget.items[0].unitPrice).toBe(500);
    expect(budget.items[0].subtotal).toBe(1000);
    expect(budget.items[1].unitPrice).toBe(999);
    expect(budget.itemsTotal).toBe(1999);
    expect(budget.total).toBe(1999);
  });

  it('increments sequenceNumber per user via CountersService', async () => {
    await service.create(userId, { clientId: client._id.toString(), items: [{ serviceId: 's1', quantity: 1 }] } as any);
    expect(countersServiceMock.getNextSequence).toHaveBeenCalledWith(`budget:${userId}`);
  });

  it('calculates travel cost via DistanceService when destinationAddress is given', async () => {
    distanceServiceMock.calculate.mockResolvedValue({
      distanceKm: 10,
      durationMin: 15,
      travelCost: 20,
      distanceCalculationId: new Types.ObjectId(),
      cached: false,
    });

    const budget = await service.create(userId, {
      clientId: client._id.toString(),
      items: [{ serviceId: 's1', quantity: 1 }],
      destinationAddress: 'Rua Destino, 50',
    } as any);

    expect(distanceServiceMock.calculate).toHaveBeenCalledWith(userId, companySettings.baseAddress, 'Rua Destino, 50', {
      pricePerKm: companySettings.pricePerKm,
      minimumTravelFee: companySettings.minimumTravelFee,
      freeRadiusKm: companySettings.freeRadiusKm,
    });
    expect(budget.travelCost).toBe(20);
    expect(budget.total).toBe(520);
  });

  it('applies discount and clamps total at 0', async () => {
    const budget = await service.create(userId, {
      clientId: client._id.toString(),
      items: [{ serviceId: 's1', quantity: 1 }],
      discount: 10000,
    } as any);

    expect(budget.total).toBe(0);
  });

  describe('updateStatus', () => {
    const budgetId = new Types.ObjectId().toString();
    const makeBudget = (status: BudgetStatus) => ({
      status,
      save: jest.fn().mockResolvedValue(undefined),
    });

    it('allows RASCUNHO -> ENVIADO and stamps sentAt', async () => {
      const budget = makeBudget(BudgetStatus.RASCUNHO);
      budgetModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(budget) });

      const result = await service.updateStatus(userId, budgetId, { status: BudgetStatus.ENVIADO } as any);
      expect(result.status).toBe(BudgetStatus.ENVIADO);
      expect((result as any).sentAt).toBeInstanceOf(Date);
    });

    it('allows ENVIADO -> APROVADO and stamps respondedAt', async () => {
      const budget = makeBudget(BudgetStatus.ENVIADO);
      budgetModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(budget) });

      const result = await service.updateStatus(userId, budgetId, { status: BudgetStatus.APROVADO } as any);
      expect((result as any).respondedAt).toBeInstanceOf(Date);
    });

    it('rejects an invalid transition (CANCELADO is terminal)', async () => {
      const budget = makeBudget(BudgetStatus.CANCELADO);
      budgetModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(budget) });

      await expect(service.updateStatus(userId, budgetId, { status: BudgetStatus.ENVIADO } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects re-cancelling an already cancelled budget', async () => {
      const budget = makeBudget(BudgetStatus.CANCELADO);
      budgetModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(budget) });

      await expect(service.updateStatus(userId, budgetId, { status: BudgetStatus.CANCELADO } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('stores statusReason when cancelling', async () => {
      const budget = makeBudget(BudgetStatus.RASCUNHO);
      budgetModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(budget) });

      const result = await service.updateStatus(userId, budgetId, {
        status: BudgetStatus.CANCELADO,
        reason: 'Cliente desistiu',
      } as any);
      expect((result as any).statusReason).toBe('Cliente desistiu');
    });
  });

  describe('update', () => {
    const budgetId = new Types.ObjectId().toString();

    const makeEditable = (status: BudgetStatus) => ({
      status,
      items: [{ serviceId: new Types.ObjectId(), name: 'Antigo', unitPrice: 100, quantity: 1, subtotal: 100 }],
      itemsTotal: 100,
      travelCost: 50,
      discount: 0,
      total: 150,
      save: jest.fn().mockResolvedValue(undefined),
    });

    it('reprices the items against the catalog and keeps the travel cost in the total', async () => {
      const budget = makeEditable(BudgetStatus.RASCUNHO);
      budgetModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(budget) });

      const result = await service.update(userId, budgetId, {
        items: [{ serviceId: 'svc1', quantity: 2 }],
      } as any);

      expect(result.items[0].unitPrice).toBe(500); // preço vem do catálogo, não do corpo
      expect(result.itemsTotal).toBe(1000);
      expect(result.total).toBe(1050); // 1000 de itens + 50 de deslocamento preservado
      expect(budget.save).toHaveBeenCalled();
    });

    it('recomputes the total when only the discount changes', async () => {
      const budget = makeEditable(BudgetStatus.ENVIADO);
      budgetModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(budget) });

      const result = await service.update(userId, budgetId, { discount: 30 } as any);

      expect(result.itemsTotal).toBe(100); // itens intocados
      expect(result.total).toBe(120); // 100 + 50 - 30
    });

    it('never lets the total go negative when the discount exceeds the value', async () => {
      const budget = makeEditable(BudgetStatus.RASCUNHO);
      budgetModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(budget) });

      const result = await service.update(userId, budgetId, { discount: 9999 } as any);

      expect(result.total).toBe(0);
    });

    it('leaves untouched every field absent from the body', async () => {
      const budget = makeEditable(BudgetStatus.RASCUNHO);
      budget.discount = 25;
      budgetModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(budget) });

      const result = await service.update(userId, budgetId, { notes: 'Nova observação' } as any);

      expect((result as any).notes).toBe('Nova observação');
      expect(result.discount).toBe(25);
      expect(result.items[0].name).toBe('Antigo');
    });

    it.each([BudgetStatus.APROVADO, BudgetStatus.REJEITADO, BudgetStatus.EXPIRADO, BudgetStatus.CANCELADO])(
      'refuses to edit a %s budget',
      async (status) => {
        const budget = makeEditable(status);
        budgetModelMock.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(budget) });

        await expect(service.update(userId, budgetId, { discount: 10 } as any)).rejects.toThrow(BadRequestException);
        expect(budget.save).not.toHaveBeenCalled();
      },
    );
  });

  describe('solar budgets', () => {
    /** Irradiação de um ponto do Ceará: chuvas no começo do ano, seca no segundo semestre. */
    const irradiance = [5.4, 5.1, 4.8, 4.6, 5.0, 5.3, 5.6, 6.1, 6.3, 6.2, 6.0, 5.7];

    const solarPayload = {
      panels: [{ quantity: 12, wattagePeak: 550 }],
      inverters: [{ quantity: 1, type: 'INVERSOR' }],
      investment: 30000,
      currentMonthlyBill: 850,
      projectedMonthlyBill: 120,
    };

    const createSolar = (overrides: Record<string, unknown> = {}) =>
      service.create(userId, {
        clientId: client._id.toString(),
        type: 'SOLAR',
        solar: { ...solarPayload, ...overrides },
      } as any);

    it('stores the order value as the budget total, with no catalogue items', async () => {
      const budget = await createSolar();

      expect(budget.type).toBe('SOLAR');
      expect(budget.items).toEqual([]);
      expect(budget.itemsTotal).toBe(30000);
      expect(budget.total).toBe(30000);
    });

    it('computes the financial indicators at creation', async () => {
      const budget = await createSolar();

      expect(budget.solar!.financials.monthlySavings).toBe(730);
      expect(budget.solar!.financials.annualSavings).toBe(8760);
      expect(budget.solar!.financials.horizonYears).toBe(25);
      expect(budget.solar!.financials.paybackMonths).toBe(42);
      expect(budget.solar!.financials.irrPercent).toBeGreaterThan(0);
    });

    it('omits payback and IRR when the bill does not drop', async () => {
      const budget = await createSolar({ currentMonthlyBill: 500, projectedMonthlyBill: 500 });

      expect(budget.solar!.financials.paybackMonths).toBeUndefined();
      expect(budget.solar!.financials.irrPercent).toBeUndefined();
    });

    it('computes generation when the local irradiance is provided', async () => {
      const budget = await createSolar({ monthlyIrradiance: irradiance });

      // 12 x 550 Wp = 6,6 kWp
      expect(budget.solar!.generation!.systemPowerKwp).toBe(6.6);
      expect(budget.solar!.generation!.monthly).toHaveLength(12);
      expect(budget.solar!.generation!.annualKwh).toBeGreaterThan(0);
      // A irradiação usada fica gravada para o cálculo poder ser reconferido depois.
      expect(budget.solar!.generation!.monthlyIrradiance).toEqual(irradiance);
    });

    // Os testes deste bloco não mockam a busca de irradiação de propósito: mostram que o
    // orçamento nasce íntegro mesmo sem o gráfico. A busca automática tem bloco próprio.
    it('creates the budget without the generation block when no irradiance can be resolved', async () => {
      const budget = await createSolar();
      expect(budget.solar!.generation).toBeUndefined();
    });

    it('snapshots the warranties from the company settings', async () => {
      companySettingsServiceMock.get.mockResolvedValue({
        ...companySettings,
        panelEfficiencyWarrantyYears: 25,
        panelDefectWarrantyYears: 12,
        inverterWarrantyYears: 10,
        installationWarrantyYears: 5,
      });

      const budget = await createSolar();

      expect(budget.solar!.warranties).toEqual({
        panelEfficiencyYears: 25,
        panelDefectYears: 12,
        inverterYears: 10,
        installationYears: 5,
      });
    });

    it('leaves the warranties empty when the company has not configured them', async () => {
      const budget = await createSolar();

      expect(budget.solar!.warranties).toEqual({
        panelEfficiencyYears: undefined,
        panelDefectYears: undefined,
        inverterYears: undefined,
        installationYears: undefined,
      });
    });

    it('sums panel models of different wattage in the same kit', async () => {
      const budget = await createSolar({
        panels: [
          { quantity: 8, wattagePeak: 550 },
          { quantity: 4, wattagePeak: 450 },
        ],
        monthlyIrradiance: irradiance,
      });

      expect(budget.solar!.generation!.systemPowerKwp).toBe(6.2);
    });

    it('still applies discount and travel cost on top of the order value', async () => {
      const budget = await service.create(userId, {
        clientId: client._id.toString(),
        type: 'SOLAR',
        solar: solarPayload,
        discount: 1000,
      } as any);

      expect(budget.total).toBe(29000);
    });

    it('rejects a solar budget created without the solar block', async () => {
      await expect(
        service.create(userId, { clientId: client._id.toString(), type: 'SOLAR' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses catalogue items on an existing solar budget', async () => {
      const budget = {
        status: BudgetStatus.RASCUNHO,
        type: 'SOLAR',
        items: [],
        itemsTotal: 30000,
        travelCost: 0,
        discount: 0,
        save: jest.fn(),
      };
      budgetModelMock.findOne = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(budget) });

      await expect(
        service.update(userId, new Types.ObjectId().toString(), { items: [{ serviceId: 's1', quantity: 1 }] } as any),
      ).rejects.toThrow(BadRequestException);
      expect(budget.save).not.toHaveBeenCalled();
    });
  });

  describe('solar irradiance lookup', () => {
    const monthly = [5.4, 5.1, 4.8, 4.6, 5.0, 5.3, 5.6, 6.1, 6.3, 6.2, 6.0, 5.7];

    const solarPayload = {
      panels: [{ quantity: 12, wattagePeak: 550 }],
      inverters: [{ quantity: 1, type: 'INVERSOR' }],
      investment: 30000,
      currentMonthlyBill: 850,
      projectedMonthlyBill: 120,
    };

    beforeEach(() => {
      solarIrradianceServiceMock.getMonthlyIrradiance.mockResolvedValue(monthly);
      distanceServiceMock.locate.mockResolvedValue({ label: 'Rua Cliente, 100', lat: -3.32, lon: -40.09 });
    });

    it('geocodes the client address and fetches the irradiance when there is no travel cost', async () => {
      const budget = await service.create(userId, {
        clientId: client._id.toString(),
        type: 'SOLAR',
        solar: solarPayload,
      } as any);

      expect(distanceServiceMock.locate).toHaveBeenCalledWith(client.address);
      expect(solarIrradianceServiceMock.getMonthlyIrradiance).toHaveBeenCalledWith(-3.32, -40.09);
      expect(budget.solar!.generation!.monthlyIrradiance).toEqual(monthly);
    });

    // O deslocamento já geocodificou o destino; pedir de novo seria uma chamada paga à toa.
    it('reuses the point resolved by the travel calculation instead of geocoding twice', async () => {
      distanceServiceMock.calculate.mockResolvedValue({
        distanceKm: 10,
        durationMin: 15,
        travelCost: 20,
        distanceCalculationId: new Types.ObjectId(),
        cached: false,
        resolvedDestination: { label: 'Rua Destino', lat: -4.1, lon: -38.5 },
      });

      await service.create(userId, {
        clientId: client._id.toString(),
        type: 'SOLAR',
        solar: solarPayload,
        calculateDistance: true,
      } as any);

      expect(distanceServiceMock.locate).not.toHaveBeenCalled();
      expect(solarIrradianceServiceMock.getMonthlyIrradiance).toHaveBeenCalledWith(-4.1, -38.5);
    });

    it('prefers an irradiance sent in the body over the automatic lookup', async () => {
      const manual = Array<number>(12).fill(4.2);

      const budget = await service.create(userId, {
        clientId: client._id.toString(),
        type: 'SOLAR',
        solar: { ...solarPayload, monthlyIrradiance: manual },
      } as any);

      expect(solarIrradianceServiceMock.getMonthlyIrradiance).not.toHaveBeenCalled();
      expect(budget.solar!.generation!.monthlyIrradiance).toEqual(manual);
    });

    // Perder equipamentos, faturas e valor já digitados porque a NASA piscou seria pior do
    // que emitir a proposta sem o gráfico.
    it('still creates the budget when the irradiance lookup fails', async () => {
      solarIrradianceServiceMock.getMonthlyIrradiance.mockRejectedValue(new Error('NASA fora do ar'));

      const budget = await service.create(userId, {
        clientId: client._id.toString(),
        type: 'SOLAR',
        solar: solarPayload,
      } as any);

      expect(budget.solar!.generation).toBeUndefined();
      expect(budget.solar!.financials.investment).toBe(30000);
      expect(budget.total).toBe(30000);
    });

    it('still creates the budget when the address cannot be geocoded', async () => {
      distanceServiceMock.locate.mockRejectedValue(new Error('Endereço não encontrado'));

      const budget = await service.create(userId, {
        clientId: client._id.toString(),
        type: 'SOLAR',
        solar: solarPayload,
      } as any);

      expect(budget.solar!.generation).toBeUndefined();
    });

    it('never looks up irradiance for a services budget', async () => {
      await service.create(userId, {
        clientId: client._id.toString(),
        items: [{ serviceId: 's1', quantity: 1 }],
      } as any);

      expect(solarIrradianceServiceMock.getMonthlyIrradiance).not.toHaveBeenCalled();
      expect(distanceServiceMock.locate).not.toHaveBeenCalled();
    });
  });

  describe('budget type defaults', () => {
    it('defaults to SERVICOS when the caller sends no type', async () => {
      const budget = await service.create(userId, {
        clientId: client._id.toString(),
        items: [{ serviceId: 's1', quantity: 1 }],
      } as any);

      expect(budget.type).toBe('SERVICOS');
      expect(budget.solar).toBeUndefined();
    });
  });

  describe('getConversionStats', () => {
    it('computes conversionRate from aggregated counts', async () => {
      (service as any).budgetModel = {
        aggregate: jest.fn().mockResolvedValue([
          { _id: BudgetStatus.APROVADO, count: 3, totalValue: 3000 },
          { _id: BudgetStatus.REJEITADO, count: 1, totalValue: 100 },
          { _id: BudgetStatus.RASCUNHO, count: 2, totalValue: 200 },
        ]),
      };

      const stats = await service.getConversionStats(userId);
      expect(stats.sent).toBe(4); // aprovados + rejeitados (rascunho não conta como "enviado")
      expect(stats.approved).toBe(3);
      expect(stats.conversionRate).toBe(0.75);
      expect(stats.totalValueApproved).toBe(3000);
    });
  });
});
