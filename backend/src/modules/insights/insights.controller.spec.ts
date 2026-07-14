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
import { Goal, GoalDocument } from '../goals/schemas/goal.schema';

const FAKE_USER_ID = new Types.ObjectId().toString();

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

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

describe('InsightsController - cashflow (e2e)', () => {
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

  it('period=year agrega por mês e preenche meses sem transação com zero', async () => {
    await transactionModel.insertMany([
      txn({ type: TransactionType.INCOME, value: 3000, date: new Date('2026-01-10') }),
      txn({ type: TransactionType.EXPENSE, value: 900, date: new Date('2026-01-20') }),
      txn({ type: TransactionType.INCOME, value: 3500, date: new Date('2026-06-05') }),
      txn({ type: TransactionType.EXPENSE, value: 1100, date: new Date('2026-06-25') }),
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/insights/cashflow')
      .query({ period: 'year', year: 2026 })
      .expect(200);

    expect(res.body.granularity).toBe('month');
    expect(res.body.points).toHaveLength(12);
    expect(res.body.points[0]).toMatchObject({ income: 3000, expense: 900 });
    expect(res.body.points[5]).toMatchObject({ income: 3500, expense: 1100 });
    // Fevereiro (índice 1) não tem transação nenhuma — precisa vir zerado, não ausente.
    expect(res.body.points[1]).toMatchObject({ income: 0, expense: 0 });
    expect(res.body.totals).toEqual({ income: 6500, expense: 2000, balance: 4500 });
  });

  it('period=month gera um bucket por dia, incluindo dias sem transação', async () => {
    // Fevereiro de 2026 (não bissexto) tem 28 dias.
    await transactionModel.insertMany([
      txn({ type: TransactionType.EXPENSE, value: 50, date: new Date('2026-02-05') }),
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/insights/cashflow')
      .query({ period: 'month', year: 2026, month: 2 })
      .expect(200);

    expect(res.body.granularity).toBe('day');
    expect(res.body.points).toHaveLength(28);
    expect(res.body.points[4]).toMatchObject({ income: 0, expense: 50 });
    expect(res.body.points[0]).toMatchObject({ income: 0, expense: 0 });
  });

  it('period=custom sem from/to retorna 400 em vez de quebrar', async () => {
    await request(app.getHttpServer())
      .get('/api/insights/cashflow')
      .query({ period: 'custom' })
      .expect(400);
  });
});

describe('InsightsController - goals-progress (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let transactionModel: Model<TransactionDocument>;
  let goalModel: Model<GoalDocument>;

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
    goalModel = app.get<Model<GoalDocument>>(getModelToken(Goal.name));
  }, 60000);

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  afterEach(async () => {
    await transactionModel.deleteMany({});
    await goalModel.deleteMany({});
  });

  it('calcula o ritmo médio só com EXPENSE na categoria vinculada (ignora INCOME na mesma categoria)', async () => {
    const linkedCategoryId = new Types.ObjectId();

    await goalModel.create({
      userId: new Types.ObjectId(FAKE_USER_ID),
      name: 'Viagem',
      targetValue: 1000,
      currentValue: 600,
      deadline: daysFromNow(60),
      completed: false,
      linkedCategoryId,
    });

    await transactionModel.insertMany([
      txn({ type: TransactionType.EXPENSE, value: 100, categoryId: linkedCategoryId, date: monthsAgo(1) }),
      txn({ type: TransactionType.EXPENSE, value: 200, categoryId: linkedCategoryId, date: monthsAgo(2) }),
      // INCOME na mesma categoria não deve contar como contribuição.
      txn({ type: TransactionType.INCOME, value: 5000, categoryId: linkedCategoryId, date: monthsAgo(1) }),
    ]);

    const res = await request(app.getHttpServer()).get('/api/insights/goals-progress').expect(200);

    expect(res.body).toHaveLength(1);
    const goal = res.body[0];
    expect(goal.pace.avgMonthlyContribution).toBe(150);
    expect(goal.pace.monthsRemaining).toBe(2);
    expect(goal.pace.requiredMonthlyContribution).toBe(200);
    expect(goal.pace.onTrack).toBe(false);
  });

  it('meta sem deadline retorna monthsRemaining/requiredMonthlyContribution nulos, sem NaN/Infinity', async () => {
    const linkedCategoryId = new Types.ObjectId();

    await goalModel.create({
      userId: new Types.ObjectId(FAKE_USER_ID),
      name: 'Reserva de emergência',
      targetValue: 5000,
      currentValue: 100,
      completed: false,
      linkedCategoryId,
    });

    const res = await request(app.getHttpServer()).get('/api/insights/goals-progress').expect(200);

    const goal = res.body[0];
    expect(goal.pace.monthsRemaining).toBeNull();
    expect(goal.pace.requiredMonthlyContribution).toBeNull();
    expect(goal.pace.onTrack).toBeNull();
    expect(Number.isFinite(goal.pace.avgMonthlyContribution)).toBe(true);
  });
});
