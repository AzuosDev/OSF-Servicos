import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { ServicesModule } from './services.module';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Appointment } from '../agenda/schemas/appointment.schema';

const FAKE_USER_ID = new Types.ObjectId().toString();

describe('ServicesController (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let appointmentModel: Model<Appointment>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const mongoUri = mongod.getUri();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRootAsync({
          useFactory: () => ({ uri: mongoUri }),
        }),
        ServicesModule,
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

    appointmentModel = app.get<Model<Appointment>>(getModelToken(Appointment.name));
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('POST creates a service and auto-links an income category', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/services')
      .send({ name: 'Lavagem Completa', defaultValue: 120 })
      .expect(201);

    expect(res.body.name).toBe('Lavagem Completa');
    expect(res.body.active).toBe(true);
    expect(res.body.categoryId).toBeDefined();
  });

  it('GET lists only services for the current user', async () => {
    const res = await request(app.getHttpServer()).get('/api/services').expect(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('DELETE blocks removal when an appointment references the service', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/services')
      .send({ name: 'Polimento', defaultValue: 300 })
      .expect(201);

    await appointmentModel.create({
      userId: new Types.ObjectId(FAKE_USER_ID),
      serviceId: new Types.ObjectId(created.body._id),
      clientName: 'Cliente Teste',
      startAt: new Date('2026-07-20T09:00:00.000Z'),
      durationMinutes: 60,
      endAt: new Date('2026-07-20T10:00:00.000Z'),
      chargedValue: 300,
    });

    await request(app.getHttpServer()).delete(`/api/services/${created.body._id}`).expect(400);
  });
});
