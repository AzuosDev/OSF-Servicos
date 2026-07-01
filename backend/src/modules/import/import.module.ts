import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema } from '../categories/schemas/category.schema';
import { TransactionsModule } from '../transactions/transactions.module';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Category.name, schema: CategorySchema }]),
    TransactionsModule,
  ],
  providers: [ImportService],
  controllers: [ImportController],
})
export class ImportModule {}
