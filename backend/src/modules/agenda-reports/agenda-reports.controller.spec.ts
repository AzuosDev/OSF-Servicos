import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { AgendaReportsModule } from './agenda-reports.module';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Service } from '../services/schemas/service.schema';
import { Appointment, AppointmentStatus, PaymentStatus } from '../agenda/schemas/appointment.schema';
import { Transaction, TransactionType } from '../transactions/schemas/transaction.schema';
import { Category } from '../categories/schemas/category.schema';

const FAKE_USER_ID = new Types.ObjectId().toString();

describe('AgendaReportsController (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let serviceModel: Model<Service>;
  let appointmentModel: Model<Appointment>;
  let transactionModel: Model<Transaction>;
  let categoryModel: Model<Category>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const mongoUri = mongod.getUri();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRootAsync({ useFactory: () => ({ uri: mongoUri }) }),
        AgendaReportsModule,
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
    appointmentModel = app.get<Model<Appointment>>(getModelToken(Appointment.name));
    transactionModel = app.get<Model<Transaction>>(getModelToken(Transaction.name));
    categoryModel = app.get<Model<Category>>(getModelToken(Category.name));
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('GET /daily-summary aggregates transactions and finalized appointments for the given date', async () => {
    const userObjectId = new Types.ObjectId(FAKE_USER_ID);
    const category = await categoryModel.create({ name: 'Serviços', slug: 'servicos-test', isIncome: true, isDefault: true });
    const service = await serviceModel.create({
      userId: userObjectId,
      name: 'Lavagem',
      defaultValue: 100,
      categoryId: category._id,
    });

    await appointmentModel.create({
      userId: userObjectId,
      serviceId: service._id,
      clientName: 'Cliente A',
      startAt: new Date('2026-08-01T09:00:00.000Z'),
      durationMinutes: 60,
      endAt: new Date('2026-08-01T10:00:00.000Z'),
      chargedValue: 100,
      status: AppointmentStatus.FINALIZADO,
      paymentStatus: PaymentStatus.PAGO,
      totalPaid: 100,
    });
    await appointmentModel.create({
      userId: userObjectId,
      serviceId: service._id,
      clientName: 'Cliente B',
      startAt: new Date('2026-08-01T11:00:00.000Z'),
      durationMinutes: 30,
      endAt: new Date('2026-08-01T11:30:00.000Z'),
      chargedValue: 50,
      status: AppointmentStatus.AGENDADO,
      paymentStatus: PaymentStatus.NAO_PAGO,
      totalPaid: 0,
    });

    await transactionModel.create({
      userId: userObjectId,
      type: TransactionType.INCOME,
      value: 100,
      categoryId: category._id,
      date: new Date('2026-08-01T09:05:00.000Z'),
    });
    await transactionModel.create({
      userId: userObjectId,
      type: TransactionType.EXPENSE,
      value: 30,
      date: new Date('2026-08-01T12:00:00.000Z'),
    });

    const res = await request(app.getHttpServer())
      .get('/api/agenda-reports/daily-summary?date=2026-08-01')
      .expect(200);

    expect(res.body.totalIncome).toBe(100);
    expect(res.body.totalExpense).toBe(30);
    expect(res.body.netProfit).toBe(70);
    expect(res.body.totalReceived).toBe(100);
    expect(res.body.servicesCompletedCount).toBe(1);
    expect(res.body.avgTicket).toBe(100);
    expect(res.body.paidCount).toBe(1);
    expect(res.body.pendingCount).toBe(1);
  });

  it('GET /dashboard returns today aggregates and top services', async () => {
    const res = await request(app.getHttpServer()).get('/api/agenda-reports/dashboard').expect(200);

    expect(res.body).toHaveProperty('entradasHoje');
    expect(res.body).toHaveProperty('saidasHoje');
    expect(res.body).toHaveProperty('lucroLiquidoHoje');
    expect(res.body).toHaveProperty('contasPendentes');
    expect(res.body).toHaveProperty('topServicesByRevenue');
    expect(res.body).toHaveProperty('dailyRevenue');
    expect(Array.isArray(res.body.dailyRevenue)).toBe(true);
  });
});
