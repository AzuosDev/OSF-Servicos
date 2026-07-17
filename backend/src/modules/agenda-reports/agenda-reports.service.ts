import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Appointment, AppointmentDocument, AppointmentStatus, PaymentStatus } from '../agenda/schemas/appointment.schema';
import { Service, ServiceDocument } from '../services/schemas/service.schema';
import { Transaction, TransactionDocument, TransactionType } from '../transactions/schemas/transaction.schema';
import { Category, CategoryDocument } from '../categories/schemas/category.schema';

function dayRange(date: string) {
  return {
    start: new Date(`${date}T00:00:00.000Z`),
    end: new Date(`${date}T23:59:59.999Z`),
  };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class AgendaReportsService {
  constructor(
    @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
    @InjectModel(Service.name) private serviceModel: Model<ServiceDocument>,
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) {}

  async getDailySummary(userId: string, date = todayKey()) {
    const userObjectId = new Types.ObjectId(userId);
    const { start, end } = dayRange(date);

    const [transactions, appointments] = await Promise.all([
      this.transactionModel.find({ userId: userObjectId, date: { $gte: start, $lte: end } }).lean().exec(),
      this.appointmentModel.find({ userId: userObjectId, startAt: { $gte: start, $lte: end } }).lean().exec(),
    ]);

    const totalIncome = transactions
      .filter((t) => t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + t.value, 0);
    const totalExpense = transactions
      .filter((t) => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + t.value, 0);

    const activeAppointments = appointments.filter((a) => a.status !== AppointmentStatus.CANCELADO);
    const completed = appointments.filter((a) => a.status === AppointmentStatus.FINALIZADO);
    const totalReceived = activeAppointments.reduce((sum, a) => sum + a.totalPaid, 0);
    const avgTicket = completed.length
      ? completed.reduce((sum, a) => sum + a.chargedValue, 0) / completed.length
      : 0;
    const paidCount = activeAppointments.filter((a) => a.paymentStatus === PaymentStatus.PAGO).length;
    const pendingCount = activeAppointments.filter((a) => a.paymentStatus !== PaymentStatus.PAGO).length;

    return {
      date,
      totalReceived,
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      servicesCompletedCount: completed.length,
      avgTicket,
      paidCount,
      pendingCount,
    };
  }

  async getDashboard(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const date = todayKey();
    const { start: todayStart, end: todayEnd } = dayRange(date);
    const thirtyDaysAgo = new Date(todayStart);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29);

    const [todayTransactions, todayAppointments, pendingAppointments, recentAppointments, categories] =
      await Promise.all([
        this.transactionModel.find({ userId: userObjectId, date: { $gte: todayStart, $lte: todayEnd } }).lean().exec(),
        this.appointmentModel.find({ userId: userObjectId, startAt: { $gte: todayStart, $lte: todayEnd } }).lean().exec(),
        this.appointmentModel
          .find({ userId: userObjectId, status: { $ne: AppointmentStatus.CANCELADO }, paymentStatus: { $ne: PaymentStatus.PAGO } })
          .lean()
          .exec(),
        this.appointmentModel
          .find({ userId: userObjectId, startAt: { $gte: thirtyDaysAgo, $lte: todayEnd }, status: { $ne: AppointmentStatus.CANCELADO } })
          .lean()
          .exec(),
        this.categoryModel.find({ $or: [{ userId: null }, { userId: userObjectId }] }).lean().exec(),
      ]);

    const entradasHoje = todayTransactions
      .filter((t) => t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + t.value, 0);
    const saidasHoje = todayTransactions
      .filter((t) => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + t.value, 0);

    const valorAReceber = pendingAppointments.reduce((sum, a) => sum + Math.max(0, a.chargedValue - a.totalPaid), 0);

    const serviceStats = new Map<string, { count: number; revenue: number }>();
    for (const a of recentAppointments) {
      const key = a.serviceId.toString();
      const entry = serviceStats.get(key) ?? { count: 0, revenue: 0 };
      entry.count += 1;
      entry.revenue += a.totalPaid;
      serviceStats.set(key, entry);
    }
    const serviceIds = Array.from(serviceStats.keys()).map((id) => new Types.ObjectId(id));
    const services = serviceIds.length
      ? await this.serviceModel.find({ _id: { $in: serviceIds } }).lean().exec()
      : [];
    const serviceNameById = new Map(services.map((s) => [s._id.toString(), s.name]));

    const serviceRows = Array.from(serviceStats.entries()).map(([serviceId, stats]) => ({
      serviceId,
      serviceName: serviceNameById.get(serviceId) ?? 'Serviço removido',
      count: stats.count,
      revenue: stats.revenue,
    }));

    const topByCount = [...serviceRows].sort((a, b) => b.count - a.count).slice(0, 5);
    const topByRevenue = [...serviceRows].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    const dailyRevenueMap = new Map<string, number>();
    for (const a of recentAppointments) {
      const key = new Date(a.startAt).toISOString().slice(0, 10);
      dailyRevenueMap.set(key, (dailyRevenueMap.get(key) ?? 0) + a.totalPaid);
    }
    const dailyRevenue: { date: string; revenue: number }[] = [];
    for (let i = 0; i < 30; i += 1) {
      const d = new Date(thirtyDaysAgo);
      d.setUTCDate(d.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyRevenue.push({ date: key, revenue: dailyRevenueMap.get(key) ?? 0 });
    }

    const categoryById = new Map(categories.map((c) => [c._id.toString(), c]));
    const recentTransactions = await this.transactionModel
      .find({ userId: userObjectId, date: { $gte: thirtyDaysAgo, $lte: todayEnd } })
      .lean()
      .exec();
    const categoryTotals = new Map<string, { name: string; total: number; isIncome: boolean }>();
    for (const t of recentTransactions) {
      if (!t.categoryId || t.type === TransactionType.TRANSFER) continue;
      const cat = categoryById.get(t.categoryId.toString());
      const name = cat?.name ?? 'Sem categoria';
      const key = `${t.type}:${name}`;
      const entry = categoryTotals.get(key) ?? { name, total: 0, isIncome: t.type === TransactionType.INCOME };
      entry.total += t.value;
      categoryTotals.set(key, entry);
    }
    const categoryBreakdown = Array.from(categoryTotals.values()).sort((a, b) => b.total - a.total);

    return {
      date,
      entradasHoje,
      saidasHoje,
      lucroLiquidoHoje: entradasHoje - saidasHoje,
      contasPendentes: { count: pendingAppointments.length, value: valorAReceber },
      totalAgendamentosHoje: todayAppointments.length,
      servicosConcluidosHoje: todayAppointments.filter((a) => a.status === AppointmentStatus.FINALIZADO).length,
      topServicesByCount: topByCount,
      topServicesByRevenue: topByRevenue,
      dailyRevenue,
      categoryBreakdown: {
        income: categoryBreakdown.filter((c) => c.isIncome),
        expense: categoryBreakdown.filter((c) => !c.isIncome),
      },
    };
  }
}
