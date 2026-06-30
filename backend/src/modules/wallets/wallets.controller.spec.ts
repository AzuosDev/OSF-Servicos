import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { WalletsModule } from './wallets.module';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Wallet } from './schemas/wallet.schema';
import { Transaction, TransactionType } from '../transactions/schemas/transaction.schema';

const FAKE_USER_ID = new Types.ObjectId().toString();

describe('WalletsController (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let walletModel: Model<Wallet>;
  let transactionModel: Model<Transaction>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const mongoUri = mongod.getUri();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRootAsync({
          useFactory: () => ({ uri: mongoUri }),
        }),
        WalletsModule,
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
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('GET does not include a virtual wallet when there is no legacy balance', async () => {
    await walletModel.create({ userId: new Types.ObjectId(FAKE_USER_ID), nome: 'Carteira única', saldo: 0 });

    const res = await request(app.getHttpServer()).get('/api/wallets').expect(200);
    expect((res.body as Array<{ tipo?: string }>).some((w) => w.tipo === 'VIRTUAL')).toBe(false);
  });

  it('GET includes a virtual wallet aggregating legacy transactions without carteiraId', async () => {
    await transactionModel.create({
      userId: new Types.ObjectId(FAKE_USER_ID),
      type: TransactionType.EXPENSE,
      value: 80,
      date: new Date('2026-03-01'),
    });
    await transactionModel.create({
      userId: new Types.ObjectId(FAKE_USER_ID),
      type: TransactionType.INCOME,
      value: 30,
      date: new Date('2026-03-02'),
    });

    const res = await request(app.getHttpServer()).get('/api/wallets').expect(200);
    const legacy = (res.body as Array<{ _id: string; tipo?: string; saldo: number }>).find((w) => w.tipo === 'VIRTUAL');
    expect(legacy).toBeDefined();
    expect(legacy!._id).toBe('legacy-wallet');
    expect(legacy!.saldo).toBe(30 - 80);
  });

  it('GET omits the virtual wallet once its net legacy balance returns to zero', async () => {
    // Estado herdado do teste anterior: saldo legado líquido de -50 (30 receita - 80
    // despesa) para FAKE_USER_ID. Uma receita extra de 50 zera o líquido.
    await transactionModel.create({
      userId: new Types.ObjectId(FAKE_USER_ID),
      type: TransactionType.INCOME,
      value: 50,
      date: new Date('2026-03-03'),
    });

    const res = await request(app.getHttpServer()).get('/api/wallets').expect(200);
    expect((res.body as Array<{ tipo?: string }>).some((w) => w.tipo === 'VIRTUAL')).toBe(false);
  });

  it('GET buckets a transaction with carteiraId stored as an empty string into the legacy wallet', async () => {
    // Estado herdado: saldo legado líquido zerado pelo teste anterior. Inserção via
    // driver nativo porque o Mongoose rejeitaria "" como ObjectId inválido no cast de
    // escrita, mas um deploy antigo/externo pode ter gravado isso direto no banco.
    await transactionModel.collection.insertOne({
      userId: new Types.ObjectId(FAKE_USER_ID),
      type: TransactionType.EXPENSE,
      value: 40,
      date: new Date('2026-04-01'),
      carteiraId: '',
    } as never);
    await transactionModel.create({
      userId: new Types.ObjectId(FAKE_USER_ID),
      type: TransactionType.INCOME,
      value: 10,
      date: new Date('2026-04-02'),
    });

    const res = await request(app.getHttpServer()).get('/api/wallets').expect(200);
    const legacy = (res.body as Array<{ tipo?: string; saldo: number }>).find((w) => w.tipo === 'VIRTUAL');
    expect(legacy).toBeDefined();
    expect(legacy!.saldo).toBe(10 - 40);
  });

  it('GET buckets a transaction whose carteiraId points to a wallet the user no longer owns', async () => {
    // Estado herdado do teste anterior: saldo legado líquido de -30.
    const orphanWalletId = new Types.ObjectId();
    await transactionModel.create({
      userId: new Types.ObjectId(FAKE_USER_ID),
      type: TransactionType.EXPENSE,
      value: 15,
      date: new Date('2026-04-03'),
      carteiraId: orphanWalletId,
    });

    const res = await request(app.getHttpServer()).get('/api/wallets').expect(200);
    const legacy = (res.body as Array<{ tipo?: string; saldo: number }>).find((w) => w.tipo === 'VIRTUAL');
    expect(legacy).toBeDefined();
    expect(legacy!.saldo).toBe(-30 - 15);
    const orphanEntry = (res.body as Array<{ _id: string }>).find((w) => w._id === orphanWalletId.toString());
    expect(orphanEntry).toBeUndefined();
  });
});
