import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { PendingAccount, PendingAccountSchema } from '../pending/schemas/pending-account.schema';
import { Appointment, AppointmentSchema } from '../agenda/schemas/appointment.schema';
import { PushSubscription, PushSubscriptionSchema } from './schemas/push-subscription.schema';
import { NotificationsService } from './notifications.service';
import { NotificationsCronService } from './notifications-cron.service';
import { PushService } from './push.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsCronController } from './notifications-cron.controller';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: PendingAccount.name, schema: PendingAccountSchema },
      { name: Appointment.name, schema: AppointmentSchema },
      { name: PushSubscription.name, schema: PushSubscriptionSchema },
    ]),
  ],
  providers: [NotificationsService, NotificationsCronService, PushService],
  controllers: [NotificationsController, NotificationsCronController],
  exports: [NotificationsService, NotificationsCronService],
})
export class NotificationsModule {}
