import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { PendingModule } from './modules/pending/pending.module';
import { GoalsModule } from './modules/goals/goals.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ExpensesModule } from './modules/expenses/expenses.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const uri = configService.get<string>('MONGODB_URI');

        if (uri && uri.trim()) {
          return { uri };
        }

        const mongoServer = await MongoMemoryServer.create();
        return { uri: mongoServer.getUri() };
      },
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60, limit: 100 }], default: { ttl: 60, limit: 100 } }),
    AuthModule,
    UsersModule,
    CategoriesModule,
    TransactionsModule,
    PendingModule,
    GoalsModule,
    DashboardModule,
    ExpensesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
