import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

@Module({
  imports: [ConfigModule, UsersModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
