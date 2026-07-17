import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { TransactionsModule } from './transactions.module';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Wallet } from '../wallets/schemas/wallet.schema';
import { Goal } from '../goals/schemas/goal.schema';
import { Transaction, TransactionType } from './schemas/transaction.schema';

const FAKE_USER_ID = new Types.ObjectId().toString();

describe('TransactionsController (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let walletModel: Model<Wallet>;
  let transactionModel: Model<Transaction>;
  let goalModel: Model<Goal>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const mongoUri = mongod.getUri();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRootAsync({
          useFactory: () => ({ uri: mongoUri }),
        }),
        TransactionsModule,
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

    walletModel = app.get<Model<Wallet>>(getModelToken(Wallet.name));
    transactionModel = app.get<Model<Transaction>>(getModelToken(Transaction.name));
    goalModel = app.get<Model<Goal>>(getModelToken(Goal.name));
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('GET injects a virtual wallet for legacy transactions without carteiraId', async () => {
    await transactionModel.create({
      userId: new Types.ObjectId(FAKE_USER_ID),
      type: TransactionType.EXPENSE,
      value: 50,
      date: new Date('2026-01-10'),
      description: 'Gasto legado sem carteira',
    });

    const res = await request(app.getHttpServer()).get('/api/transactions').expect(200);
    const item = (res.body.data as Array<{ description: string; carteira?: { nome: string; tipo: string } }>).find(
      (t) => t.description === 'Gasto legado sem carteira',
    );
    expect(item).toBeDefined();
    expect(item!.carteira?.tipo).toBe('VIRTUAL');
    expect(item!.carteira?.nome).toBe('Saldo Histórico (Sem Carteira)');
  });

  it('GET does not inject a virtual wallet when carteiraId is present', async () => {
    const wallet = await walletModel.create({ userId: new Types.ObjectId(FAKE_USER_ID), nome: 'Carteira real', saldo: 0 });
    await transactionModel.create({
      userId: new Types.ObjectId(FAKE_USER_ID),
      type: TransactionType.EXPENSE,
      value: 30,
      date: new Date('2026-01-11'),
      description: 'Gasto com carteira',
      carteiraId: wallet._id,
    });

    const res = await request(app.getHttpServer()).get('/api/transactions').expect(200);
    const item = (res.body.data as Array<{ description: string; carteira?: unknown }>).find(
      (t) => t.description === 'Gasto com carteira',
    );
    expect(item).toBeDefined();
    expect(item!.carteira).toBeUndefined();
  });

  it('POST with goalId contributes the value to an open goal', async () => {
    const userObjectId = new Types.ObjectId(FAKE_USER_ID);
    const wallet = await walletModel.create({ userId: userObjectId, nome: 'Carteira meta', saldo: 0 });
    const goal = await goalModel.create({ userId: userObjectId, name: 'Viagem', targetValue: 1000, currentValue: 200 });

    const res = await request(app.getHttpServer())
      .post('/api/transactions')
      .send({ type: 'INCOME', value: 300, carteiraId: wallet._id.toString(), goalId: goal._id.toString(), date: '2026-02-05' })
      .expect(201);

    expect(res.body.goalId).toBe(goal._id.toString());

    const updatedGoal = await goalModel.findById(goal._id).exec();
    expect(updatedGoal!.currentValue).toBe(500);
    expect(updatedGoal!.completed).toBe(false);
  });

  it('POST rejects a goalId that belongs to another user or does not exist', async () => {
    const wallet = await walletModel.create({ userId: new Types.ObjectId(FAKE_USER_ID), nome: 'Carteira meta 2', saldo: 0 });
    const foreignGoal = await goalModel.create({ userId: new Types.ObjectId(), name: 'Meta de outro usuário', targetValue: 100, currentValue: 0 });

    await request(app.getHttpServer())
      .post('/api/transactions')
      .send({ type: 'INCOME', value: 50, carteiraId: wallet._id.toString(), goalId: foreignGoal._id.toString(), date: '2026-02-05' })
      .expect(400);
  });

  it('POST rejects a goalId for a goal already completed', async () => {
    const userObjectId = new Types.ObjectId(FAKE_USER_ID);
    const wallet = await walletModel.create({ userId: userObjectId, nome: 'Carteira meta 3', saldo: 0 });
    const goal = await goalModel.create({ userId: userObjectId, name: 'Meta concluída', targetValue: 100, currentValue: 100, completed: true });

    await request(app.getHttpServer())
      .post('/api/transactions')
      .send({ type: 'INCOME', value: 50, carteiraId: wallet._id.toString(), goalId: goal._id.toString(), date: '2026-02-05' })
      .expect(400);
  });

  it('DELETE reverts the goal contribution made by the transaction', async () => {
    const userObjectId = new Types.ObjectId(FAKE_USER_ID);
    const wallet = await walletModel.create({ userId: userObjectId, nome: 'Carteira meta 4', saldo: 0 });
    const goal = await goalModel.create({ userId: userObjectId, name: 'Reserva', targetValue: 1000, currentValue: 100 });

    const created = await request(app.getHttpServer())
      .post('/api/transactions')
      .send({ type: 'INCOME', value: 150, carteiraId: wallet._id.toString(), goalId: goal._id.toString(), date: '2026-02-05' })
      .expect(201);

    let updatedGoal = await goalModel.findById(goal._id).exec();
    expect(updatedGoal!.currentValue).toBe(250);

    await request(app.getHttpServer()).delete(`/api/transactions/${created.body._id}`).expect(200);

    updatedGoal = await goalModel.findById(goal._id).exec();
    expect(updatedGoal!.currentValue).toBe(100);
  });

  it('PATCH /bulk-wallet associates legacy transactions and updates wallet saldo by net impact', async () => {
    const wallet = await walletModel.create({ userId: new Types.ObjectId(FAKE_USER_ID), nome: 'Carteira destino', saldo: 0 });

    const expense = await transactionModel.create({
      userId: new Types.ObjectId(FAKE_USER_ID),
      type: TransactionType.EXPENSE,
      value: 100,
      date: new Date('2026-02-01'),
      description: 'Despesa legada',
    });
    const income = await transactionModel.create({
      userId: new Types.ObjectId(FAKE_USER_ID),
      type: TransactionType.INCOME,
      value: 40,
      date: new Date('2026-02-02'),
      description: 'Receita legada',
    });

    const res = await request(app.getHttpServer())
      .patch('/api/transactions/bulk-wallet')
      .send({ transactionIds: [expense._id.toString(), income._id.toString()], targetWalletId: wallet._id.toString() })
      .expect(200);

    expect(res.body.updatedCount).toBe(2);
    expect(res.body.impact).toBe(40 - 100);

    const updatedExpense = await transactionModel.findById(expense._id).exec();
    const updatedIncome = await transactionModel.findById(income._id).exec();
    expect(updatedExpense!.carteiraId?.toString()).toBe(wallet._id.toString());
    expect(updatedIncome!.carteiraId?.toString()).toBe(wallet._id.toString());

    const updatedWallet = await walletModel.findById(wallet._id).exec();
    expect(updatedWallet!.saldo).toBe(40 - 100);
  });

  it('PATCH /bulk-wallet rejects transactions that already have a wallet', async () => {
    const walletA = await walletModel.create({ userId: new Types.ObjectId(FAKE_USER_ID), nome: 'A', saldo: 0 });
    const walletB = await walletModel.create({ userId: new Types.ObjectId(FAKE_USER_ID), nome: 'B', saldo: 0 });
    const tx = await transactionModel.create({
      userId: new Types.ObjectId(FAKE_USER_ID),
      type: TransactionType.EXPENSE,
      value: 10,
      date: new Date('2026-02-03'),
      carteiraId: walletA._id,
    });

    await request(app.getHttpServer())
      .patch('/api/transactions/bulk-wallet')
      .send({ transactionIds: [tx._id.toString()], targetWalletId: walletB._id.toString() })
      .expect(400);
  });

  it('PATCH /bulk-wallet returns 404 when target wallet does not belong to the user', async () => {
    const otherUserWallet = await walletModel.create({ userId: new Types.ObjectId(), nome: 'De outro usuário', saldo: 0 });
    const tx = await transactionModel.create({
      userId: new Types.ObjectId(FAKE_USER_ID),
      type: TransactionType.EXPENSE,
      value: 10,
      date: new Date('2026-02-04'),
    });

    await request(app.getHttpServer())
      .patch('/api/transactions/bulk-wallet')
      .send({ transactionIds: [tx._id.toString()], targetWalletId: otherUserWallet._id.toString() })
      .expect(404);
  });

  it('GET ?semCategoria=true retorna apenas transações sem categoryId e não lança erro', async () => {
    const categoryId = new Types.ObjectId();
    await transactionModel.create({
      userId: new Types.ObjectId(FAKE_USER_ID),
      type: TransactionType.EXPENSE,
      value: 20,
      date: new Date('2026-03-01'),
      description: 'Com categoria',
      categoryId,
    });
    await transactionModel.create({
      userId: new Types.ObjectId(FAKE_USER_ID),
      type: TransactionType.EXPENSE,
      value: 15,
      date: new Date('2026-03-02'),
      description: 'Sem categoria A',
    });
    await transactionModel.create({
      userId: new Types.ObjectId(FAKE_USER_ID),
      type: TransactionType.EXPENSE,
      value: 25,
      date: new Date('2026-03-03'),
      description: 'Sem categoria B',
    });

    const res = await request(app.getHttpServer())
      .get('/api/transactions?semCategoria=true')
      .expect(200);

    const descriptions = (res.body.data as Array<{ description: string; categoryId?: unknown }>).map((t) => t.description);
    expect(descriptions).toContain('Sem categoria A');
    expect(descriptions).toContain('Sem categoria B');
    expect(descriptions).not.toContain('Com categoria');
    res.body.data.forEach((t: { categoryId?: unknown }) => {
      expect(t.categoryId == null).toBe(true);
    });
  });
});
