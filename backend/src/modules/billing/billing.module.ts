import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { BillingCronService } from './billing-cron.service';
import { BillingCronController } from './billing-cron.controller';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    NotificationsModule,
    MongooseModule.forFeature([{ name: Invoice.name, schema: InvoiceSchema }]),
  ],
  controllers: [BillingController, BillingCronController],
  providers: [BillingService, BillingCronService],
  exports: [BillingService],
})
export class BillingModule {}
