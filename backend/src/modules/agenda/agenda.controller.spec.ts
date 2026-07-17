import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { AgendaModule } from './agenda.module';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Service } from '../services/schemas/service.schema';
import { Transaction } from '../transactions/schemas/transaction.schema';

const FAKE_USER_ID = new Types.ObjectId().toString();

describe('AgendaController (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let serviceModel: Model<Service>;
  let transactionModel: Model<Transaction>;
  let serviceId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const mongoUri = mongod.getUri();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRootAsync({
          useFactory: () => ({ uri: mongoUri }),
        }),
        AgendaModule,
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

    serviceModel = app.get<Model<Service>>(getModelToken(Service.name));
    transactionModel = app.get<Model<Transaction>>(getModelToken(Transaction.name));

    const service = await serviceModel.create({
      userId: new Types.ObjectId(FAKE_USER_ID),
      name: 'Lavagem Completa',
      defaultValue: 120,
      categoryId: new Types.ObjectId(),
    });
    serviceId = service._id.toString();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('POST creates an appointment computing endAt from duration', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/appointments')
      .send({
        serviceId,
        clientName: 'João Silva',
        startAt: '2026-07-16T09:00:00.000Z',
        durationMinutes: 90,
      })
      .expect(201);

    expect(res.body.endAt).toBe('2026-07-16T10:30:00.000Z');
    expect(res.body.chargedValue).toBe(120);
    expect(res.body.paymentStatus).toBe('NAO_PAGO');
  });

  it('POST rejects an overlapping appointment', async () => {
    await request(app.getHttpServer())
      .post('/api/appointments')
      .send({
        serviceId,
        clientName: 'Maria Souza',
        startAt: '2026-07-16T10:00:00.000Z',
        durationMinutes: 30,
      })
      .expect(400);
  });

  it('POST allows a non-overlapping appointment right after the previous one ends', async () => {
    await request(app.getHttpServer())
      .post('/api/appointments')
      .send({
        serviceId,
        clientName: 'Carlos Lima',
        startAt: '2026-07-16T10:30:00.000Z',
        durationMinutes: 30,
      })
      .expect(201);
  });

  it('POST /:id/payments accumulates payments and flips paymentStatus to PAGO, creating a Transaction', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/appointments')
      .send({
        serviceId,
        clientName: 'Ana Paula',
        startAt: '2026-07-17T09:00:00.000Z',
        durationMinutes: 60,
        chargedValue: 300,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/appointments/${created.body._id}/payments`)
      .send({ method: 'PIX', value: 100 })
      .expect(201);

    const partial = await request(app.getHttpServer())
      .post(`/api/appointments/${created.body._id}/payments`)
      .send({ method: 'DINHEIRO', value: 200 })
      .expect(201);

    expect(partial.body.totalPaid).toBe(300);
    expect(partial.body.paymentStatus).toBe('PAGO');
    expect(partial.body.payments).toHaveLength(2);

    const transactions = await transactionModel.find({ description: 'Pagamento - Ana Paula' }).exec();
    expect(transactions).toHaveLength(2);
    expect(transactions.reduce((sum, t) => sum + t.value, 0)).toBe(300);
  });

  it('GET /accounts-receivable lists appointments with pending balance only', async () => {
    const res = await request(app.getHttpServer()).get('/api/appointments/accounts-receivable').expect(200);
    const clientNames = (res.body as Array<{ clientName: string }>).map((a) => a.clientName);
    expect(clientNames).toContain('João Silva');
    expect(clientNames).not.toContain('Ana Paula');
  });
});
