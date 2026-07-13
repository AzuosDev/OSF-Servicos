import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { Model, Types } from 'mongoose';
import { InsightsModule } from './insights.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Transaction, TransactionDocument, TransactionType } from '../transactions/schemas/transaction.schema';

const FAKE_USER_ID = new Types.ObjectId().toString();

function txn(overrides: Partial<Record<string, unknown>>) {
  return {
    userId: new Types.ObjectId(FAKE_USER_ID),
    type: TransactionType.EXPENSE,
    value: 100,
    date: new Date('2026-01-15'),
    ...overrides,
  };
}

describe('InsightsController - annual-summary (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let transactionModel: Model<TransactionDocument>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRootAsync({ useFactory: () => ({ uri: mongod.getUri() }) }),
        InsightsModule,
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
    await app.init();

    transactionModel = app.get<Model<TransactionDocument>>(getModelToken(Transaction.name));
  }, 60000);

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  afterEach(async () => {
    await transactionModel.deleteMany({});
  });

  it('calcula a média mensal usando só os meses com transações reais, não sempre 12', async () => {
    // 2026: só janeiro, março e junho têm lançamentos (3 meses com dado)
    await transactionModel.insertMany([
      txn({ type: TransactionType.INCOME, value: 3000, date: new Date('2026-01-10') }),
      txn({ type: TransactionType.EXPENSE, value: 900, date: new Date('2026-01-20') }),
      txn({ type: TransactionType.INCOME, value: 3000, date: new Date('2026-03-10') }),
      txn({ type: TransactionType.EXPENSE, value: 900, date: new Date('2026-03-20') }),
      txn({ type: TransactionType.INCOME, value: 3000, date: new Date('2026-06-10') }),
      txn({ type: TransactionType.EXPENSE, value: 900, date: new Date('2026-06-20') }),
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/insights/annual-summary')
      .query({ year: 2026 })
      .expect(200);

    expect(res.body.current.monthsWithData).toBe(3);
    expect(res.body.current.totalIncome).toBe(9000);
    expect(res.body.current.totalExpense).toBe(2700);
    // Média deve dividir por 3 (meses com dado), não por 12.
    expect(res.body.current.avgMonthlyIncome).toBe(3000);
    expect(res.body.current.avgMonthlyExpense).toBe(900);
  });

  it('trata ausência de dado no ano anterior sem gerar Infinity/NaN na variação ano-a-ano', async () => {
    // Só há lançamentos em 2026; 2025 (ano anterior) fica totalmente vazio.
    await transactionModel.insertMany([
      txn({ type: TransactionType.INCOME, value: 4000, date: new Date('2026-02-10') }),
      txn({ type: TransactionType.EXPENSE, value: 1000, date: new Date('2026-02-15'), categoryId: new Types.ObjectId() }),
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/insights/annual-summary')
      .query({ year: 2026 })
      .expect(200);

    expect(res.body.previous.monthsWithData).toBe(0);
    expect(res.body.previous.avgMonthlyIncome).toBe(0);
    expect(res.body.yoyChange.incomePct).toBeNull();
    expect(res.body.yoyChange.expensePct).toBeNull();
    expect(res.body.yoyChange.balancePct).toBeNull();

    for (const category of res.body.topCategories) {
      expect(category.yoyPct).toBeNull();
      expect(Number.isFinite(category.yoyPct)).toBe(false);
    }
  });

  it('degrada graciosamente (200 + narrative null) quando ANTHROPIC_API_KEY não está configurada', async () => {
    await transactionModel.insertMany([
      txn({ type: TransactionType.INCOME, value: 2000, date: new Date('2026-04-10') }),
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/insights/annual-summary')
      .query({ year: 2026 })
      .expect(200);

    expect(res.body.narrative).toBeNull();
    expect(res.body.narrativeUnavailable).toBe(true);
    // Os números calculados continuam disponíveis mesmo sem narrativa da IA.
    expect(res.body.current.totalIncome).toBe(2000);
  });
});
