import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PendingAccount, PendingAccountSchema } from './schemas/pending-account.schema';
import { PendingService } from './pending.service';
import { PendingController } from './pending.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: PendingAccount.name, schema: PendingAccountSchema }])],
  providers: [PendingService],
  controllers: [PendingController],
})
export class PendingModule {}
