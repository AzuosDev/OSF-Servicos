import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { DashboardModule } from './dashboard.module';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PendingAccount } from '../pending/schemas/pending-account.schema';
import { Transaction, TransactionType } from '../transactions/schemas/transaction.schema';
import { Category } from '../categories/schemas/category.schema';

const FAKE_USER_ID = new Types.ObjectId().toString();

describe('DashboardController (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let pendingModel: Model<PendingAccount>;
  let transactionModel: Model<Transaction>;
  let categoryModel: Model<Category>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const mongoUri = mongod.getUri();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRootAsync({
          useFactory: () => ({ uri: mongoUri }),
        }),
        DashboardModule,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { _id: new Types.ObjectId(FAKE_USER_ID) };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    pendingModel = app.get<Model<PendingAccount>>(getModelToken(PendingAccount.name));
    transactionModel = app.get<Model<Transaction>>(getModelToken(Transaction.name));
    categoryModel = app.get<Model<Category>>(getModelToken(Category.name));
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('GET includes a legacy unpaid account (no tipo field in storage) in the pendingAccounts widget', async () => {
    // Mesmo cenário de pending.controller.spec.ts: documento gravado antes do campo
    // `tipo` existir, inserido via driver nativo para não receber o default do Mongoose.
    const legacyId = new Types.ObjectId();
    await pendingModel.collection.insertOne({
      _id: legacyId,
      userId: new Types.ObjectId(FAKE_USER_ID),
      title: 'Conta legada sem tipo',
      value: 75,
      dueDate: new Date('2026-06-05'),
      paid: false,
      isParcelada: false,
      isRecorrente: false,
      categoria: 'Outro',
      formatoPagamento: 'Outro',
    });

    const res = await request(app.getHttpServer())
      .get('/api/dashboard')
      .query({ month: 6, year: 2026 })
      .expect(200);

    const items = res.body.pendingAccounts.items as Array<{ _id: string }>;
    expect(items.some((item) => item._id === legacyId.toString())).toBe(true);
  });

  describe('GET /category-breakdown', () => {
    it('daily only includes EXPENSE transactions from the exact given date', async () => {
      const userObjectId = new Types.ObjectId(FAKE_USER_ID);
      const category = await categoryModel.create({ name: 'Combustível', slug: 'combustivel-test', isDefault: true });

      await transactionModel.create({
        userId: userObjectId,
        type: TransactionType.EXPENSE,
        value: 40,
        categoryId: category._id,
        date: new Date('2026-05-10T12:00:00.000Z'),
      });
      await transactionModel.create({
        userId: userObjectId,
        type: TransactionType.EXPENSE,
        value: 999,
        categoryId: category._id,
        date: new Date('2026-05-11T00:00:00.000Z'),
      });
      await transactionModel.create({
        userId: userObjectId,
        type: TransactionType.INCOME,
        value: 500,
        categoryId: category._id,
        date: new Date('2026-05-10T08:00:00.000Z'),
      });

      const res = await request(app.getHttpServer())
        .get('/api/dashboard/category-breakdown')
        .query({ type: 'EXPENSE', period: 'daily', date: '2026-05-10' })
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].total).toBe(40);
      expect(res.body.items[0].categoryName).toBe('Combustível');
    });

    it('weekly uses a Sunday-to-Saturday window around the anchor date', async () => {
      const userObjectId = new Types.ObjectId(FAKE_USER_ID);
      const anchor = new Date('2026-06-17T00:00:00.000Z'); // quarta-feira
      const dow = anchor.getUTCDay();
      const sunday = new Date(anchor);
      sunday.setUTCDate(anchor.getUTCDate() - dow);
      const saturday = new Date(sunday);
      saturday.setUTCDate(sunday.getUTCDate() + 6);
      const beforeSunday = new Date(sunday);
      beforeSunday.setUTCDate(sunday.getUTCDate() - 1);
      const afterSaturday = new Date(saturday);
      afterSaturday.setUTCDate(saturday.getUTCDate() + 1);

      await transactionModel.create({ userId: userObjectId, type: TransactionType.EXPENSE, value: 10, date: sunday });
      await transactionModel.create({ userId: userObjectId, type: TransactionType.EXPENSE, value: 20, date: saturday });
      await transactionModel.create({ userId: userObjectId, type: TransactionType.EXPENSE, value: 300, date: beforeSunday });
      await transactionModel.create({ userId: userObjectId, type: TransactionType.EXPENSE, value: 400, date: afterSaturday });

      const res = await request(app.getHttpServer())
        .get('/api/dashboard/category-breakdown')
        .query({ type: 'EXPENSE', period: 'weekly', date: '2026-06-17' })
        .expect(200);

      const total = (res.body.items as Array<{ total: number }>).reduce((sum, i) => sum + i.total, 0);
      expect(total).toBe(30);
    });

    it('monthly aggregates EXPENSE transactions for the given month/year only', async () => {
      const userObjectId = new Types.ObjectId(FAKE_USER_ID);
      await transactionModel.create({ userId: userObjectId, type: TransactionType.EXPENSE, value: 15, date: new Date('2026-09-01T00:00:00.000Z') });
      await transactionModel.create({ userId: userObjectId, type: TransactionType.EXPENSE, value: 25, date: new Date('2026-09-30T23:59:00.000Z') });
      await transactionModel.create({ userId: userObjectId, type: TransactionType.EXPENSE, value: 999, date: new Date('2026-08-31T23:59:00.000Z') });
      await transactionModel.create({ userId: userObjectId, type: TransactionType.EXPENSE, value: 999, date: new Date('2026-10-01T00:00:00.000Z') });

      const res = await request(app.getHttpServer())
        .get('/api/dashboard/category-breakdown')
        .query({ type: 'EXPENSE', period: 'monthly', month: 9, year: 2026 })
        .expect(200);

      const total = (res.body.items as Array<{ total: number }>).reduce((sum, i) => sum + i.total, 0);
      expect(total).toBe(40);
    });

    it('yearly aggregates INCOME transactions for the given year only', async () => {
      const userObjectId = new Types.ObjectId(FAKE_USER_ID);
      await transactionModel.create({ userId: userObjectId, type: TransactionType.INCOME, value: 1000, date: new Date('2027-02-01') });
      await transactionModel.create({ userId: userObjectId, type: TransactionType.INCOME, value: 2000, date: new Date('2027-11-01') });
      await transactionModel.create({ userId: userObjectId, type: TransactionType.INCOME, value: 9999, date: new Date('2028-01-01') });

      const res = await request(app.getHttpServer())
        .get('/api/dashboard/category-breakdown')
        .query({ type: 'INCOME', period: 'yearly', year: 2027 })
        .expect(200);

      const total = (res.body.items as Array<{ total: number }>).reduce((sum, i) => sum + i.total, 0);
      expect(total).toBe(3000);
    });
  });
});
