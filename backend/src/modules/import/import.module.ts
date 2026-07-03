import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema } from '../categories/schemas/category.schema';
import { TransactionsModule } from '../transactions/transactions.module';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { ImportBatch, ImportBatchSchema } from './schemas/import-batch.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
      { name: ImportBatch.name, schema: ImportBatchSchema },
    ]),
    TransactionsModule,
  ],
  providers: [ImportService],
  controllers: [ImportController],
})
export class ImportModule {}
