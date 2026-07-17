import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Appointment, AppointmentSchema } from '../agenda/schemas/appointment.schema';
import { Service, ServiceSchema } from '../services/schemas/service.schema';
import { Transaction, TransactionSchema } from '../transactions/schemas/transaction.schema';
import { Category, CategorySchema } from '../categories/schemas/category.schema';
import { AgendaReportsService } from './agenda-reports.service';
import { AgendaReportsController } from './agenda-reports.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Appointment.name, schema: AppointmentSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
  ],
  providers: [AgendaReportsService],
  controllers: [AgendaReportsController],
})
export class AgendaReportsModule {}
