import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Budget, BudgetDocument, BudgetStatus } from './schemas/budget.schema';
import { ClientsService } from './clients.service';
import { CompanySettingsService, companyOrigin } from './company-settings.service';
import { CountersService } from './counters.service';
import { DistanceService } from './distance.service';
import { ServicesService } from '../services/services.service';
import { calculatePanelCleaningSubtotal, isPanelCleaningService } from './pricing/panel-cleaning-pricing';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { CreateBudgetItemDto } from './dto/create-budget-item.dto';
import { GetBudgetsDto } from './dto/get-budgets.dto';
import { UpdateBudgetStatusDto } from './dto/update-budget-status.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

const VALID_TRANSITIONS: Record<BudgetStatus, BudgetStatus[]> = {
  [BudgetStatus.RASCUNHO]: [BudgetStatus.ENVIADO, BudgetStatus.CANCELADO],
  [BudgetStatus.ENVIADO]: [BudgetStatus.APROVADO, BudgetStatus.REJEITADO, BudgetStatus.EXPIRADO, BudgetStatus.CANCELADO],
  [BudgetStatus.APROVADO]: [BudgetStatus.CANCELADO],
  [BudgetStatus.REJEITADO]: [],
  [BudgetStatus.EXPIRADO]: [],
  [BudgetStatus.CANCELADO]: [],
};

// Depois de aprovado/rejeitado/expirado/cancelado o orçamento vira registro histórico —
// alterar valores nesses estados reescreveria o que já foi combinado com o cliente.
const EDITABLE_STATUSES: BudgetStatus[] = [BudgetStatus.RASCUNHO, BudgetStatus.ENVIADO];

const DEFAULT_VALID_DAYS = 7;

@Injectable()
export class BudgetsService {
  constructor(
    @InjectModel(Budget.name) private budgetModel: Model<BudgetDocument>,
    private clientsService: ClientsService,
    private companySettingsService: CompanySettingsService,
    private countersService: CountersService,
    private distanceService: DistanceService,
    private servicesService: ServicesService,
  ) {}

  /**
   * Resolve os itens contra o catálogo de serviços — nome e preço saem sempre do serviço
   * cadastrado, nunca do que o cliente do app mandou. Compartilhado por `create` e `update`
   * para que uma edição precifique exatamente como a criação.
   */
  private async buildItems(userId: string, itemDtos: CreateBudgetItemDto[]) {
    return Promise.all(
      itemDtos.map(async (itemDto) => {
        const service = await this.servicesService.findOne(userId, itemDto.serviceId);

        if (itemDto.unitPriceOverride == null && isPanelCleaningService(service.name)) {
          const subtotal = calculatePanelCleaningSubtotal(itemDto.quantity);
          return {
            serviceId: service._id,
            name: service.name,
            unitPrice: subtotal / itemDto.quantity,
            quantity: itemDto.quantity,
            subtotal,
          };
        }

        const unitPrice = itemDto.unitPriceOverride ?? service.defaultValue;
        return {
          serviceId: service._id,
          name: service.name,
          unitPrice,
          quantity: itemDto.quantity,
          subtotal: unitPrice * itemDto.quantity,
        };
      }),
    );
  }

  async create(userId: string, dto: CreateBudgetDto): Promise<BudgetDocument> {
    const client = await this.clientsService.findOne(userId, dto.clientId);
    const companySettings = await this.companySettingsService.get(userId);

    const items = await this.buildItems(userId, dto.items);

    const itemsTotal = items.reduce((sum, item) => sum + item.subtotal, 0);

    let travelCost = 0;
    let distanceCalculationId: Types.ObjectId | undefined;
    if (dto.calculateDistance || dto.destinationAddress) {
      const destinationAddress = dto.destinationAddress ?? client.address;
      const distance = await this.distanceService.calculate(userId, companyOrigin(companySettings), destinationAddress, {
        pricePerKm: companySettings.pricePerKm,
        minimumTravelFee: companySettings.minimumTravelFee,
        freeRadiusKm: companySettings.freeRadiusKm,
      });
      travelCost = distance.travelCost;
      distanceCalculationId = distance.distanceCalculationId;
    }

    const discount = dto.discount ?? 0;
    const total = Math.max(0, itemsTotal + travelCost - discount);

    const sequenceNumber = await this.countersService.getNextSequence(`budget:${userId}`);

    const validUntil = dto.validUntil
      ? new Date(dto.validUntil)
      : new Date(Date.now() + DEFAULT_VALID_DAYS * 24 * 60 * 60 * 1000);

    return this.budgetModel.create({
      userId: new Types.ObjectId(userId),
      sequenceNumber,
      clientId: client._id,
      items,
      itemsTotal,
      travelCost,
      discount,
      total,
      distanceCalculationId,
      status: BudgetStatus.RASCUNHO,
      notes: dto.notes,
      validUntil,
    });
  }

  async findAll(userId: string, query: GetBudgetsDto) {
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (query.status) {
      filter.status = query.status;
    }
    if (query.clientId) {
      filter.clientId = new Types.ObjectId(query.clientId);
    }
    if (query.from || query.to) {
      filter.createdAt = {
        ...(query.from && { $gte: new Date(query.from) }),
        ...(query.to && { $lte: new Date(query.to) }),
      };
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const [items, total] = await Promise.all([
      this.budgetModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.budgetModel.countDocuments(filter).exec(),
    ]);

    return { items, total, page, limit };
  }

  async findOne(userId: string, id: string): Promise<BudgetDocument> {
    const budget = await this.budgetModel
      .findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) })
      .exec();
    if (!budget) {
      throw new NotFoundException('Orçamento não encontrado');
    }
    return budget;
  }

  async update(userId: string, id: string, dto: UpdateBudgetDto): Promise<BudgetDocument> {
    const budget = await this.findOne(userId, id);

    if (!EDITABLE_STATUSES.includes(budget.status)) {
      throw new BadRequestException(
        `Não é possível editar um orçamento ${budget.status}. Só é possível editar orçamentos em ${EDITABLE_STATUSES.join(' ou ')}.`,
      );
    }

    if (dto.items) {
      budget.items = await this.buildItems(userId, dto.items);
      budget.itemsTotal = budget.items.reduce((sum, item) => sum + item.subtotal, 0);
    }
    if (dto.discount !== undefined) {
      budget.discount = dto.discount;
    }
    if (dto.notes !== undefined) {
      budget.notes = dto.notes;
    }
    if (dto.validUntil !== undefined) {
      budget.validUntil = new Date(dto.validUntil);
    }

    // O deslocamento não é editável aqui, mas continua entrando no total.
    budget.total = Math.max(0, budget.itemsTotal + budget.travelCost - budget.discount);

    await budget.save();
    return budget;
  }

  async updateStatus(userId: string, id: string, dto: UpdateBudgetStatusDto): Promise<BudgetDocument> {
    const budget = await this.findOne(userId, id);
    const allowed = VALID_TRANSITIONS[budget.status];

    if (!allowed.includes(dto.status)) {
      const allowedList = allowed.length > 0 ? allowed.join(', ') : 'nenhuma (status final)';
      throw new BadRequestException(
        `Não é possível mudar de ${budget.status} para ${dto.status}. Transições permitidas a partir de ${budget.status}: ${allowedList}`,
      );
    }

    budget.status = dto.status;

    if (dto.status === BudgetStatus.ENVIADO) {
      budget.sentAt = new Date();
    }
    if (dto.status === BudgetStatus.APROVADO || dto.status === BudgetStatus.REJEITADO) {
      budget.respondedAt = new Date();
    }
    if (dto.status === BudgetStatus.REJEITADO || dto.status === BudgetStatus.CANCELADO) {
      budget.statusReason = dto.reason;
    }

    await budget.save();
    return budget;
  }

  async getConversionStats(userId: string, from?: string, to?: string) {
    const match: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (from || to) {
      match.createdAt = {
        ...(from && { $gte: new Date(from) }),
        ...(to && { $lte: new Date(to) }),
      };
    }

    const grouped = await this.budgetModel.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 }, totalValue: { $sum: '$total' } } },
    ]);

    const byStatus = new Map(grouped.map((g) => [g._id as BudgetStatus, { count: g.count as number, totalValue: g.totalValue as number }]));
    const countOf = (status: BudgetStatus) => byStatus.get(status)?.count ?? 0;

    const total = grouped.reduce((sum, g) => sum + g.count, 0);
    const sent = countOf(BudgetStatus.ENVIADO) + countOf(BudgetStatus.APROVADO) + countOf(BudgetStatus.REJEITADO) + countOf(BudgetStatus.EXPIRADO);
    const approved = countOf(BudgetStatus.APROVADO);
    const rejected = countOf(BudgetStatus.REJEITADO);
    const conversionRate = sent > 0 ? approved / sent : 0;
    const totalValueApproved = byStatus.get(BudgetStatus.APROVADO)?.totalValue ?? 0;

    return { total, sent, approved, rejected, conversionRate, totalValueApproved };
  }
}
