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

describe('BudgetsService', () => {
  let service: BudgetsService;
  let budgetModelMock: { create: jest.Mock; findOne: jest.Mock };
  let clientsServiceMock: { findOne: jest.Mock };
  let companySettingsServiceMock: { get: jest.Mock };
  let countersServiceMock: { getNextSequence: jest.Mock };
  let distanceServiceMock: { calculate: jest.Mock };
  let servicesServiceMock: { findOne: jest.Mock };

  const userId = new Types.ObjectId().toString();
  const client = { _id: new Types.ObjectId(), address: 'Rua Cliente, 100' };
  const companySettings = { baseAddress: 'Rua Empresa, 1', pricePerKm: 2, minimumTravelFee: 20, freeRadiusKm: 5 };

  beforeEach(async () => {
    budgetModelMock = { create: jest.fn((doc) => Promise.resolve(doc)), findOne: jest.fn() };
    clientsServiceMock = { findOne: jest.fn().mockResolvedValue(client) };
    companySettingsServiceMock = { get: jest.fn().mockResolvedValue(companySettings) };
    countersServiceMock = { getNextSequence: jest.fn().mockResolvedValue(1) };
    distanceServiceMock = { calculate: jest.fn() };
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
