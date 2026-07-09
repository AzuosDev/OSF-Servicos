import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { WalletsModule } from './wallets.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Wallet } from './schemas/wallet.schema';
import { Transaction } from '../transactions/schemas/transaction.schema';

const FAKE_USER_ID = new Types.ObjectId().toString();

describe('Wallet transfer + delete reversal (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let walletModel: Model<Wallet>;
  let transactionModel: Model<Transaction>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const mongoUri = mongod.getUri();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRootAsync({ useFactory: () => ({ uri: mongoUri }) }),
        WalletsModule,
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
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  function saldoDe(wallets: Array<{ _id: string; saldo: number }>, id: string) {
    return wallets.find((w) => w._id === id)?.saldo;
  }

  it('reverte o saldo de origem e destino ao deletar uma transferência, respeitando saldo inicial', async () => {
    // Cenário real reportado: uma das carteiras tem saldo inicial != 0 antes da transferência.
    const origem = await walletModel.create({ userId: new Types.ObjectId(FAKE_USER_ID), nome: 'Banco do Brasil', saldo: 300 });
    const destino = await walletModel.create({ userId: new Types.ObjectId(FAKE_USER_ID), nome: 'Físico', saldo: 50 });

    const before = (await request(app.getHttpServer()).get('/api/wallets').expect(200)).body as Array<{ _id: string; saldo: number }>;
    expect(saldoDe(before, origem._id.toString())).toBe(300);
    expect(saldoDe(before, destino._id.toString())).toBe(50);

    await request(app.getHttpServer())
      .post('/api/wallets/transfer')
      .send({
        carteiraOrigemId: origem._id.toString(),
        carteiraDestinoId: destino._id.toString(),
        value: 100,
        date: '2026-01-01',
      })
      .expect(201);

    const afterTransfer = (await request(app.getHttpServer()).get('/api/wallets').expect(200)).body as Array<{ _id: string; saldo: number }>;
    expect(saldoDe(afterTransfer, origem._id.toString())).toBe(200);
    expect(saldoDe(afterTransfer, destino._id.toString())).toBe(150);

    const transferTx = await transactionModel.findOne({ carteiraId: origem._id, carteiraDestinoId: destino._id }).exec();
    expect(transferTx).not.toBeNull();

    await request(app.getHttpServer()).delete(`/api/transactions/${transferTx!._id.toString()}`).expect(200);

    const afterDelete = (await request(app.getHttpServer()).get('/api/wallets').expect(200)).body as Array<{ _id: string; saldo: number }>;
    expect(saldoDe(afterDelete, origem._id.toString())).toBe(300);
    expect(saldoDe(afterDelete, destino._id.toString())).toBe(50);

    // findOne (tela de detalhe da carteira) precisa refletir a mesma reversão.
    const origemDetail = await request(app.getHttpServer()).get(`/api/wallets/${origem._id.toString()}`).expect(200);
    const destinoDetail = await request(app.getHttpServer()).get(`/api/wallets/${destino._id.toString()}`).expect(200);
    expect((origemDetail.body as { saldo: number }).saldo).toBe(300);
    expect((destinoDetail.body as { saldo: number }).saldo).toBe(50);
  });
});
