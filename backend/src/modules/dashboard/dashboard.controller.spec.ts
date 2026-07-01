import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { DashboardModule } from './dashboard.module';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PendingAccount } from '../pending/schemas/pending-account.schema';

const FAKE_USER_ID = new Types.ObjectId().toString();

describe('DashboardController (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let pendingModel: Model<PendingAccount>;

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
});
