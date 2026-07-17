import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { ServicesModule } from './services.module';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Appointment } from '../agenda/schemas/appointment.schema';
import { Category } from '../categories/schemas/category.schema';

const FAKE_USER_ID = new Types.ObjectId().toString();

describe('ServicesController (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let appointmentModel: Model<Appointment>;
  let categoryModel: Model<Category>;

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
    // Category é registrado dentro de CategoriesModule (importado por ServicesModule) sem
    // ser reexportado — { strict: false } busca no container inteiro, ignorando o
    // encapsulamento normal de módulos, só para fins de asserção no teste.
    categoryModel = app.get<Model<Category>>(getModelToken(Category.name), { strict: false });
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

  it('POST defaults color to green and mirrors it onto the linked category when none is given', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/services')
      .send({ name: 'Enceramento', defaultValue: 80 })
      .expect(201);

    expect(res.body.color).toBe('#22C55E');
    const category = await categoryModel.findById(res.body.categoryId).exec();
    expect(category!.color).toBe('#22C55E');
  });

  it('POST uses the chosen color instead of the default when provided', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/services')
      .send({ name: 'Higienização Interna', defaultValue: 150, color: '#8B5CF6' })
      .expect(201);

    expect(res.body.color).toBe('#8B5CF6');
    const category = await categoryModel.findById(res.body.categoryId).exec();
    expect(category!.color).toBe('#8B5CF6');
  });

  it('POST rejects an invalid hex color', async () => {
    await request(app.getHttpServer())
      .post('/api/services')
      .send({ name: 'Serviço Inválido', defaultValue: 50, color: 'not-a-color' })
      .expect(400);
  });

  it('PATCH updates the color and keeps the linked category in sync', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/services')
      .send({ name: 'Cera Premium', defaultValue: 200 })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/api/services/${created.body._id}`)
      .send({ color: '#F97316' })
      .expect(200);

    expect(updated.body.color).toBe('#F97316');
    const category = await categoryModel.findById(created.body.categoryId).exec();
    expect(category!.color).toBe('#F97316');
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
