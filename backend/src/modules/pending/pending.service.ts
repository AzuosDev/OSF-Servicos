import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PendingAccount, PendingAccountDocument } from './schemas/pending-account.schema';
import { Transaction, TransactionDocument, TransactionType } from '../transactions/schemas/transaction.schema';
import { Category, CategoryDocument } from '../categories/schemas/category.schema';
import { CreatePendingDto } from './dto/create-pending.dto';
import { UpdatePendingDto } from './dto/update-pending.dto';

@Injectable()
export class PendingService {
  constructor(
    @InjectModel(PendingAccount.name) private pendingModel: Model<PendingAccountDocument>,
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) {}

  private static readonly CATEGORY_KEYWORDS: Record<string, string[]> = {
    'Transporte': [
      'moto', 'carro', 'bike', 'bicicleta', 'ônibus', 'onibus', 'taxi', 'táxi',
      'uber', '99', 'cabify', 'combustível', 'combustivel', 'gasolina', 'etanol',
      'diesel', 'pedágio', 'pedagio', 'estacionamento', 'bros', 'fan', 'cg',
      'honda', 'yamaha', 'kawasaki', 'suzuki', 'ducati', 'bmw', 'ford', 'gol',
      'civic', 'corolla', 'fiat', 'volkswagen', 'chevrolet', 'hyundai', 'renault',
      'metrô', 'metro', 'trem', 'ônibus', 'viação', 'viacão', 'transporte', 'veículo',
    ],
    'Alimentação': [
      'restaurante', 'lanche', 'mercado', 'supermercado', 'pizza', 'hamburguer',
      'hambúrguer', 'açaí', 'acai', 'refeição', 'refeicao', 'almoço', 'almoco',
      'jantar', 'café', 'cafe', 'padaria', 'ifood', 'rappi', 'delivery', 'comida',
      'feira', 'hortifruti', 'churrasco', 'sushi', 'lanchonete', 'mcdonald',
      'burger king', 'subway', 'habib', 'china', 'japonês', 'japonesa', 'bar',
    ],
    'Saúde': [
      'médico', 'medico', 'farmácia', 'farmacia', 'remédio', 'remedio', 'consulta',
      'dentista', 'hospital', 'plano', 'unimed', 'amil', 'bradesco saude', 'academia',
      'clínica', 'clinica', 'exame', 'laboratorio', 'laboratório', 'cirurgia',
      'fisioterapia', 'psicólogo', 'psicologo', 'psiquiatra', 'terapia', 'saúde',
      'saude', 'vacina', 'drogaria', 'drogasil', 'ultrafarma',
    ],
    'Educação': [
      'escola', 'faculdade', 'curso', 'livro', 'material', 'mensalidade',
      'universidade', 'colégio', 'colegio', 'aula', 'apostila', 'udemy', 'alura',
      'estudo', 'educação', 'educacao', 'senai', 'senac', 'idioma', 'inglês', 'ingles',
      'espanhol', 'vestibular', 'concurso', 'pós', 'pos', 'mba', 'graduação',
    ],
    'Lazer': [
      'cinema', 'show', 'festa', 'viagem', 'hotel', 'streaming', 'netflix', 'spotify',
      'amazon prime', 'disney', 'hbo', 'jogo', 'game', 'esporte', 'teatro', 'museu',
      'parque', 'steam', 'playstation', 'xbox', 'nintendo', 'ingresso', 'balada',
      'clube', 'piscina', 'praia', 'viagem', 'hospedagem', 'airbnb', 'booking',
    ],
  };

  private resolveCategory(categoriaText: string): string | null {
    const lower = categoriaText.toLowerCase().trim();
    for (const [category, keywords] of Object.entries(PendingService.CATEGORY_KEYWORDS)) {
      if (keywords.some((kw) => lower.includes(kw) || kw.includes(lower))) {
        return category;
      }
    }
    return null;
  }

  private addMonths(date: Date, months: number) {
    const nextDate = new Date(date);
    nextDate.setMonth(nextDate.getMonth() + months);
    return nextDate;
  }

  private async createExpenseTransaction(pending: PendingAccountDocument) {
    const userId = pending.userId as Types.ObjectId;
    let category = null;

    if (pending.categoria && pending.categoria.toLowerCase() !== 'outro') {
      // 1. Busca exata (case-insensitive)
      category = await this.categoryModel
        .findOne({
          name: { $regex: new RegExp(`^${pending.categoria}$`, 'i') },
          $or: [{ userId: null }, { userId: userId }],
        })
        .exec();

      // 2. Sem match exato → tenta mapeamento por palavras-chave
      if (!category) {
        const mapped = this.resolveCategory(pending.categoria);
        if (mapped) {
          category = await this.categoryModel
            .findOne({
              name: { $regex: new RegExp(`^${mapped}$`, 'i') },
              $or: [{ userId: null }, { userId: userId }],
            })
            .exec();
        }
      }
    }

    await this.transactionModel.create({
      userId,
      type: TransactionType.EXPENSE,
      value: pending.value,
      categoryId: category?._id ?? undefined,
      description: pending.title,
      date: pending.dueDate,
      pendingAccountId: pending._id,
    });
  }

  async create(userId: string, dto: CreatePendingDto) {
    if (dto.isParcelada) {
      if (!dto.parcelas) {
        throw new BadRequestException('Parcelas sao obrigatorias quando isParcelada = true');
      }
      const { totalParcelas } = dto.parcelas;
      if (totalParcelas <= 0) {
        throw new BadRequestException('totalParcelas deve ser maior que zero');
      }

      const baseDate = new Date(dto.dueDate);
      const valorParcela = Number((dto.value / totalParcelas).toFixed(2));
      const grupoParceladoId = new Types.ObjectId().toString();
      const docs = Array.from({ length: totalParcelas }, (_, index) => {
        const numeroParcela = index + 1;
        const dueDate = this.addMonths(baseDate, index);
        return {
          userId: new Types.ObjectId(userId),
          title: dto.title,
          value: valorParcela,
          dueDate,
          description: dto.description,
          paid: false,
          paidAt: undefined,
          isParcelada: true,
          isRecorrente: false,
          categoria: dto.categoria,
          formatoPagamento: dto.formatoPagamento,
          numeroParcela,
          grupoParceladoId,
          parcelas: {
            totalParcelas,
            valorParcela,
            qtdParcelasPagas: 0,
            parcelasPagas: [],
            dataInicio: baseDate,
            dataFim: this.addMonths(baseDate, totalParcelas - 1),
          },
        };
      });

      return this.pendingModel.insertMany(docs);
    }

    if (dto.isRecorrente && !dto.recorrencia) {
      throw new BadRequestException('Recorrencia e obrigatoria quando isRecorrente = true');
    }

    const created = new this.pendingModel({
      userId: new Types.ObjectId(userId),
      title: dto.title,
      value: dto.value,
      dueDate: new Date(dto.dueDate),
      description: dto.description,
      paid: false,
      isParcelada: false,
      isRecorrente: dto.isRecorrente ?? false,
      categoria: dto.categoria,
      formatoPagamento: dto.formatoPagamento,
      recorrencia: dto.recorrencia
        ? {
            periodoRecorrencia: dto.recorrencia.periodoRecorrencia,
            dataProxima: dto.recorrencia.dataProxima
              ? new Date(dto.recorrencia.dataProxima)
              : new Date(dto.dueDate),
          }
        : undefined,
    });

    return created.save();
  }

  async findAll(userId: string, month?: number, year?: number, paid?: boolean) {
    const uid = new Types.ObjectId(userId);

    // Sem filtro de mês: retorna moldes e contas normais
    if (!month || !year) {
      const filter: Record<string, unknown> = {
        userId: uid,
        recorrenciaTemplateId: { $exists: false },
      };
      if (typeof paid === 'boolean') filter.paid = paid;
      return this.pendingModel.find(filter).sort({ dueDate: 1 }).exec();
    }

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    // 1. Contas normais (não recorrentes, não instâncias)
    const regularFilter: Record<string, unknown> = {
      userId: uid,
      isRecorrente: { $ne: true },
      recorrenciaTemplateId: { $exists: false },
      dueDate: { $gte: monthStart, $lte: monthEnd },
    };
    if (typeof paid === 'boolean') regularFilter.paid = paid;
    const regularAccounts = await this.pendingModel.find(regularFilter).sort({ dueDate: 1 }).exec();

    // 2. Moldes recorrentes
    const templates = await this.pendingModel
      .find({ userId: uid, isRecorrente: true, recorrenciaTemplateId: { $exists: false } })
      .exec();

    // 3. Instâncias já criadas para este mês (pagamentos)
    const instances = await this.pendingModel
      .find({
        userId: uid,
        recorrenciaTemplateId: { $exists: true, $ne: null },
        dueDate: { $gte: monthStart, $lte: monthEnd },
      })
      .exec();

    const instanceByTemplate = new Map<string, PendingAccountDocument>();
    for (const inst of instances) {
      if (inst.recorrenciaTemplateId) {
        instanceByTemplate.set(inst.recorrenciaTemplateId, inst);
      }
    }

    // 4. Projeção JIT dos moldes recorrentes
    const recurringEntries: Record<string, unknown>[] = [];

    for (const template of templates) {
      const templateId = template._id.toString();
      const startDate = new Date(template.dueDate);
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth() + 1;
      const startDay = startDate.getDate();
      const periodo = template.recorrencia?.periodoRecorrencia ?? 'Mensal';

      let shouldProject = false;
      if (periodo === 'Mensal' || periodo === 'Diário' || periodo === 'Semanal') {
        shouldProject = year > startYear || (year === startYear && month >= startMonth);
      } else if (periodo === 'Anual') {
        shouldProject = month === startMonth && year >= startYear;
      }

      if (!shouldProject) continue;

      const existingInstance = instanceByTemplate.get(templateId);

      if (existingInstance) {
        if (existingInstance.skipped) continue;
        if (typeof paid === 'boolean' && existingInstance.paid !== paid) continue;
        recurringEntries.push(existingInstance.toObject() as Record<string, unknown>);
      } else {
        if (paid === true) continue; // virtual sempre é não paga

        const daysInMonth = new Date(year, month, 0).getDate();
        const day = Math.min(startDay, daysInMonth);
        const projectedDueDate = new Date(year, month - 1, day);

        const templateObj = template.toObject() as Record<string, unknown>;
        recurringEntries.push({
          ...templateObj,
          dueDate: projectedDueDate,
          paid: false,
          paidAt: undefined,
          isVirtual: true,
          templateId,
          recorrenciaTemplateId: templateId,
        });
      }
    }

    const allResults = [
      ...regularAccounts.map(d => d.toObject() as Record<string, unknown>),
      ...recurringEntries,
    ];

    return allResults.sort(
      (a, b) =>
        new Date(a.dueDate as string | Date).getTime() -
        new Date(b.dueDate as string | Date).getTime(),
    );
  }

  async payRecurringInstance(userId: string, templateId: string, month: number, year: number) {
    const uid = new Types.ObjectId(userId);

    const template = await this.pendingModel
      .findOne({ _id: new Types.ObjectId(templateId), userId: uid, isRecorrente: true })
      .exec();

    if (!template) throw new NotFoundException('Molde recorrente não encontrado');

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const existing = await this.pendingModel
      .findOne({
        userId: uid,
        recorrenciaTemplateId: templateId,
        dueDate: { $gte: monthStart, $lte: monthEnd },
      })
      .exec();

    if (existing) {
      if (!existing.paid) {
        existing.paid = true;
        existing.paidAt = new Date();
        await existing.save();
        await this.createExpenseTransaction(existing);
      }
      return existing;
    }

    const startDay = new Date(template.dueDate).getDate();
    const daysInMonth = new Date(year, month, 0).getDate();
    const day = Math.min(startDay, daysInMonth);
    const dueDate = new Date(year, month - 1, day);

    const instance = new this.pendingModel({
      userId: uid,
      title: template.title,
      value: template.value,
      dueDate,
      description: template.description,
      isParcelada: false,
      isRecorrente: false,
      categoria: template.categoria,
      formatoPagamento: template.formatoPagamento,
      recorrenciaTemplateId: templateId,
      paid: true,
      paidAt: new Date(),
    });

    await instance.save();
    await this.createExpenseTransaction(instance);
    return instance;
  }

  async update(userId: string, id: string, dto: UpdatePendingDto) {
    const pending = await this.pendingModel
      .findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) })
      .exec();
    if (!pending) throw new NotFoundException('Pending account not found');

    if (typeof dto.title !== 'undefined') pending.title = dto.title;
    if (typeof dto.value !== 'undefined') pending.value = dto.value;
    if (typeof dto.dueDate !== 'undefined') pending.dueDate = new Date(dto.dueDate);
    if (typeof dto.description !== 'undefined') pending.description = dto.description;

    if (dto.isRecorrente === true && !dto.recorrencia && !pending.recorrencia) {
      throw new BadRequestException('Recorrencia e obrigatoria quando isRecorrente = true');
    }

    const wasPaid = pending.paid;
    if (typeof dto.paid !== 'undefined') {
      pending.paid = dto.paid;
      if (dto.paid) pending.paidAt = pending.paidAt ?? new Date();
    }

    await pending.save();

    // Auto-cria transação de gasto quando conta é paga pela primeira vez
    if (dto.paid === true && !wasPaid) {
      await this.createExpenseTransaction(pending);
    }

    return pending;
  }

  async skipRecurringMonth(userId: string, templateId: string, month: number, year: number) {
    const uid = new Types.ObjectId(userId);
    const template = await this.pendingModel
      .findOne({ _id: new Types.ObjectId(templateId), userId: uid, isRecorrente: true })
      .exec();
    if (!template) throw new NotFoundException('Molde recorrente não encontrado');

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const existing = await this.pendingModel
      .findOne({ userId: uid, recorrenciaTemplateId: templateId, dueDate: { $gte: monthStart, $lte: monthEnd } })
      .exec();

    if (existing) {
      if (existing.paid) {
        await this.transactionModel.deleteMany({ userId: uid, pendingAccountId: existing._id }).exec();
      }
      await existing.deleteOne();
    }

    // Cria marcador de mês pulado para o JIT não projetar este mês
    const startDay = new Date(template.dueDate).getDate();
    const day = Math.min(startDay, new Date(year, month, 0).getDate());
    await this.pendingModel.create({
      userId: uid,
      title: template.title,
      value: template.value,
      dueDate: new Date(year, month - 1, day),
      isParcelada: false,
      isRecorrente: false,
      categoria: template.categoria,
      recorrenciaTemplateId: templateId,
      paid: false,
      skipped: true,
    });

    return { skipped: true };
  }

  async remove(userId: string, id: string) {
    const uid = new Types.ObjectId(userId);
    const oid = new Types.ObjectId(id);
    const result = await this.pendingModel.findOneAndDelete({ _id: oid, userId: uid }).exec() as unknown as PendingAccountDocument | null;
    if (!result) throw new NotFoundException('Pending account not found');
    await this.transactionModel.deleteMany({ userId: uid, pendingAccountId: oid }).exec();
    // Se for molde recorrente, remove todas as instâncias/skip markers
    if (result.isRecorrente) {
      const instances = await this.pendingModel.find({ userId: uid, recorrenciaTemplateId: id }).exec();
      const instanceIds = instances.map(i => i._id);
      if (instanceIds.length) {
        await this.transactionModel.deleteMany({ userId: uid, pendingAccountId: { $in: instanceIds } }).exec();
        await this.pendingModel.deleteMany({ userId: uid, recorrenciaTemplateId: id }).exec();
      }
    }
    return { deleted: true };
  }

  async findGroup(userId: string, grupoParceladoId: string) {
    const uid = new Types.ObjectId(userId);
    return this.pendingModel
      .find({ userId: uid, grupoParceladoId })
      .sort({ numeroParcela: 1 })
      .exec();
  }

  async removeGroup(userId: string, grupoParceladoId: string) {
    const uid = new Types.ObjectId(userId);
    const accounts = await this.pendingModel.find({ userId: uid, grupoParceladoId }).exec();
    if (!accounts.length) throw new NotFoundException('Pending account not found');
    const ids = accounts.map(a => a._id);
    await this.pendingModel.deleteMany({ userId: uid, grupoParceladoId }).exec();
    await this.transactionModel.deleteMany({ userId: uid, pendingAccountId: { $in: ids } }).exec();
    return { deleted: true, count: accounts.length };
  }
}
