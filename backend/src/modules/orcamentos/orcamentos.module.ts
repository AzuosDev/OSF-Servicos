import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Client, ClientSchema } from './schemas/client.schema';
import { CompanySettings, CompanySettingsSchema } from './schemas/company-settings.schema';
import { Budget, BudgetSchema } from './schemas/budget.schema';
import { DistanceCalculation, DistanceCalculationSchema } from './schemas/distance-calculation.schema';
import { Counter, CounterSchema } from './schemas/counter.schema';
import { SolarIrradiance, SolarIrradianceSchema } from './schemas/solar-irradiance.schema';
import { ServicesModule } from '../services/services.module';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { CompanySettingsService } from './company-settings.service';
import { CompanySettingsController } from './company-settings.controller';
import { CountersService } from './counters.service';
import { DistanceService } from './distance.service';
import { DistanceController } from './distance.controller';
import { BudgetsService } from './budgets.service';
import { BudgetsController } from './budgets.controller';
import { PdfService } from './pdf.service';
import { SolarIrradianceService } from './solar/solar-irradiance.service';
import { SolarOrderService } from './solar/solar-order.service';
import { SolarOrderController } from './solar/solar-order.controller';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Client.name, schema: ClientSchema },
      { name: CompanySettings.name, schema: CompanySettingsSchema },
      { name: Budget.name, schema: BudgetSchema },
      { name: DistanceCalculation.name, schema: DistanceCalculationSchema },
      { name: Counter.name, schema: CounterSchema },
      { name: SolarIrradiance.name, schema: SolarIrradianceSchema },
    ]),
    ServicesModule,
  ],
  providers: [
    ClientsService,
    CompanySettingsService,
    CountersService,
    DistanceService,
    SolarIrradianceService,
    SolarOrderService,
    BudgetsService,
    PdfService,
  ],
  controllers: [
    ClientsController,
    CompanySettingsController,
    DistanceController,
    SolarOrderController,
    BudgetsController,
  ],
})
export class OrcamentosModule {}
