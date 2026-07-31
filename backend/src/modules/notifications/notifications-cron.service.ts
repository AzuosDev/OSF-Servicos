import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { FilterQuery, Model, Types } from 'mongoose';
import { PendingAccount, PendingAccountDocument } from '../pending/schemas/pending-account.schema';
import { Appointment, AppointmentDocument, AppointmentStatus } from '../agenda/schemas/appointment.schema';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { NotificationType } from './schemas/notification.schema';

type NewCountByUser = Map<string, number>;
type PushItem = { title: string; body: string };
type ItemsByUser = Map<string, PushItem[]>;

@Injectable()
export class NotificationsCronService {
  private readonly logger = new Logger(NotificationsCronService.name);
  private isRunning = false;

  constructor(
    @InjectModel(PendingAccount.name)
    private readonly pendingModel: Model<PendingAccountDocument>,
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<AppointmentDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly pushService: PushService,
  ) {}

  @Cron('0 8 * * *', { timeZone: 'America/Sao_Paulo' })
  async handleDailyNotifications() {
    if (process.env.CRON_NOTIFICATIONS !== 'true') return;
    if (this.isRunning) {
      this.logger.warn('Notification cron already running, skipping');
      return;
    }
    this.isRunning = true;
    try {
      await this.generateGlobalNotifications();
    } catch (err) {
      this.logger.error('Error generating notifications', err);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Varredura completa (todos os usuários). Usada pelo cron interno (best-effort,
   * não confiável em serverless) e pelo endpoint público /api/notifications/cron/check,
   * que um serviço externo (cron-job.org) chama algumas vezes ao dia.
   *
   * É a ÚNICA via que dispara push notification (o app pode estar fechado) — o
   * check disparado a cada login só grava no banco para o sininho in-app, já que
   * nesse caso o usuário já está com o app aberto.
   */
  async generateGlobalNotifications() {
    const accounts = await this.generatePendingAccountNotifications();
    const services = await this.generateServiceNotCompletedNotifications();

    await this.pushIndividualNotifications(accounts.itemsByUser, services.itemsByUser);

    this.logger.log(
      `Global sweep: ${accounts.total} conta(s) pendente(s), ${services.total} serviço(s) não concluído(s)`,
    );
    return { pendingAccounts: accounts.total, servicesNotCompleted: services.total };
  }

  /**
   * Varredura escopada a um único usuário. Roda de forma síncrona a cada login
   * (AuthService.login) porque em ambiente serverless (Vercel) o cron do
   * @nestjs/schedule não tem garantia de disparar — não há processo persistente
   * entre invocações. Não envia push: o usuário já está no app nesse momento.
   */
  async generateNotificationsForUser(userId: Types.ObjectId) {
    await Promise.all([
      this.generatePendingAccountNotifications(userId),
      this.generateServiceNotCompletedNotifications(userId),
    ]);
  }

  /**
   * Envia uma push separada para CADA item pendente no momento (não só os
   * criados nesta execução) — assim, se o cron externo rodar várias vezes ao
   * dia, o usuário recebe push a cada execução enquanto houver pendência, em
   * vez de só na primeira vez que ela foi detectada. Cada notificação já traz
   * na descrição qual conta ou qual cliente ela se refere, em vez de um
   * resumo agregado.
   */
  private async pushIndividualNotifications(accountItemsByUser: ItemsByUser, serviceItemsByUser: ItemsByUser) {
    const userIds = new Set([...accountItemsByUser.keys(), ...serviceItemsByUser.keys()]);

    await Promise.all(
      Array.from(userIds).map(async (userId) => {
        const items = [...(accountItemsByUser.get(userId) ?? []), ...(serviceItemsByUser.get(userId) ?? [])];
        const objectId = new Types.ObjectId(userId);
        await Promise.all(items.map((item) => this.pushService.sendToUser(objectId, item)));
      }),
    );
  }

  private todayEnd(): Date {
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);
    return todayEnd;
  }

  private previousDayRange(): { start: Date; end: Date } {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 1);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCHours(23, 59, 59, 999);
    return { start, end };
  }

  private bumpCount(map: NewCountByUser, userId: Types.ObjectId) {
    const key = userId.toString();
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  private pushItem(map: ItemsByUser, userId: Types.ObjectId, item: PushItem) {
    const key = userId.toString();
    const items = map.get(key);
    if (items) items.push(item);
    else map.set(key, [item]);
  }

  /** Contas a pagar vencidas/vencendo hoje e contas a receber atrasadas. */
  private async generatePendingAccountNotifications(
    userId?: Types.ObjectId,
  ): Promise<{ total: number; newByUser: NewCountByUser; itemsByUser: ItemsByUser }> {
    const filter: FilterQuery<PendingAccountDocument> = {
      paid: false,
      skipped: { $ne: true },
      dueDate: { $lte: this.todayEnd() },
    };
    if (userId) filter.userId = userId;

    const accounts = await this.pendingModel.find(filter).lean().exec();

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const newByUser: NewCountByUser = new Map();
    const itemsByUser: ItemsByUser = new Map();

    for (const account of accounts) {
      const dueDay = new Date(account.dueDate);
      dueDay.setUTCHours(0, 0, 0, 0);
      const isToday = dueDay.getTime() === todayStart.getTime();

      let type: NotificationType;
      let title: string;

      if (account.tipo === 'RECEBER') {
        type = isToday ? 'VENCE_HOJE_RECEBER' : 'VENCIDA_RECEBER';
        title = isToday ? 'Recebimento esperado hoje' : 'Recebimento em atraso';
      } else {
        type = isToday ? 'VENCE_HOJE_PAGAR' : 'VENCIDA_PAGAR';
        title = isToday ? 'Conta vence hoje' : 'Conta vencida';
      }

      const valueFormatted = account.value.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const message = `${account.title} — R$ ${valueFormatted}`;

      const accountUserId = account.userId as Types.ObjectId;
      this.pushItem(itemsByUser, accountUserId, { title, body: message });
      const isNew = await this.notificationsService.upsertNotification({
        userId: accountUserId,
        pendingAccountId: (account as { _id: Types.ObjectId })._id,
        type,
        title,
        message,
        generatedDate: todayStart,
      });
      if (isNew) this.bumpCount(newByUser, accountUserId);
    }

    return { total: accounts.length, newByUser, itemsByUser };
  }

  /** Agendamentos de ontem que ainda não foram marcados como concluídos (nem cancelados). */
  private async generateServiceNotCompletedNotifications(
    userId?: Types.ObjectId,
  ): Promise<{ total: number; newByUser: NewCountByUser; itemsByUser: ItemsByUser }> {
    const { start, end } = this.previousDayRange();
    const filter: FilterQuery<AppointmentDocument> = {
      startAt: { $gte: start, $lte: end },
      status: { $in: [AppointmentStatus.AGENDADO, AppointmentStatus.EM_ANDAMENTO] },
    };
    if (userId) filter.userId = userId;

    const appointments = await this.appointmentModel.find(filter).lean().exec();
    const newByUser: NewCountByUser = new Map();
    const itemsByUser: ItemsByUser = new Map();

    for (const appointment of appointments) {
      const appointmentUserId = appointment.userId as Types.ObjectId;
      const { isNew, title, message } = await this.notificationsService.upsertServiceNotCompletedNotification({
        userId: appointmentUserId,
        appointmentId: (appointment as { _id: Types.ObjectId })._id,
        clientName: appointment.clientName,
        date: appointment.startAt,
      });
      this.pushItem(itemsByUser, appointmentUserId, { title, body: message });
      if (isNew) this.bumpCount(newByUser, appointmentUserId);
    }

    return { total: appointments.length, newByUser, itemsByUser };
  }
}
