import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types } from 'mongoose';
import { OrcamentosModule } from './orcamentos.module';
import { ServicesModule } from '../services/services.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

jest.setTimeout(30000);

const FAKE_USER_ID = new Types.ObjectId().toString();
const OTHER_USER_ID = new Types.ObjectId().toString();

const geocodeResponse = (lon: number, lat: number) => ({ features: [{ geometry: { coordinates: [lon, lat] } }] });
const directionsResponse = (distanceMeters: number, durationSeconds: number) => ({
  routes: [{ summary: { distance: distanceMeters, duration: durationSeconds } }],
});

const guardFor = (userId: string) => ({
  canActivate: (context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest();
    req.user = { _id: new Types.ObjectId(userId) };
    return true;
  },
});

describe('BudgetsController (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let fetchSpy: jest.SpyInstance;

  const buildApp = async (userId: string) => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        MongooseModule.forRootAsync({ useFactory: () => ({ uri: mongod.getUri() }) }),
        OrcamentosModule,
        ServicesModule,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(guardFor(userId))
      .compile();

    const builtApp = moduleFixture.createNestApplication();
    builtApp.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await builtApp.init();
    return builtApp;
  };

  beforeAll(async () => {
    process.env.ORS_API_KEY = 'test-ors-key';
    mongod = await MongoMemoryServer.create();
    app = await buildApp(FAKE_USER_ID);
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  async function seedClientServiceCompany(target: INestApplication) {
    const service = await request(target.getHttpServer())
      .post('/api/services')
      .send({ name: 'Instalação de painel solar', defaultValue: 1500 })
      .expect(201);

    const client = await request(target.getHttpServer())
      .post('/api/orcamentos/clients')
      .send({ name: 'Cliente OSF', address: 'Rua Cliente, 500' })
      .expect(201);

    await request(target.getHttpServer())
      .put('/api/orcamentos/company-settings')
      .send({ companyName: 'OSF Serviços', baseAddress: 'Rua Empresa, 1', pricePerKm: 2, minimumTravelFee: 20, freeRadiusKm: 5 })
      .expect(200);

    return { service: service.body, client: client.body };
  }

  it('POST creates a budget with item snapshot and no travel cost when distance is not requested', async () => {
    const { service, client } = await seedClientServiceCompany(app);

    const res = await request(app.getHttpServer())
      .post('/api/orcamentos/budgets')
      .send({ clientId: client._id, items: [{ serviceId: service._id, quantity: 2 }] })
      .expect(201);

    expect(res.body.items[0].name).toBe('Instalação de painel solar');
    expect(res.body.items[0].unitPrice).toBe(1500);
    expect(res.body.itemsTotal).toBe(3000);
    expect(res.body.travelCost).toBe(0);
    expect(res.body.total).toBe(3000);
    expect(res.body.sequenceNumber).toBe(1);
    expect(res.body.status).toBe('RASCUNHO');
  });

  it('sequenceNumber increments for the same user and restarts for a different user', async () => {
    const { service, client } = await seedClientServiceCompany(app);

    const second = await request(app.getHttpServer())
      .post('/api/orcamentos/budgets')
      .send({ clientId: client._id, items: [{ serviceId: service._id, quantity: 1 }] })
      .expect(201);
    expect(second.body.sequenceNumber).toBe(2);

    const otherApp = await buildApp(OTHER_USER_ID);
    const { service: otherService, client: otherClient } = await seedClientServiceCompany(otherApp);
    const otherBudget = await request(otherApp.getHttpServer())
      .post('/api/orcamentos/budgets')
      .send({ clientId: otherClient._id, items: [{ serviceId: otherService._id, quantity: 1 }] })
      .expect(201);
    expect(otherBudget.body.sequenceNumber).toBe(1);
    await otherApp.close();
  });

  it('calculates travel cost via ORS (mocked) when destinationAddress is given', async () => {
    const { service, client } = await seedClientServiceCompany(app);

    fetchSpy = jest.spyOn(global, 'fetch');
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(geocodeResponse(-46.6, -23.5)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(geocodeResponse(-46.7, -23.6)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(directionsResponse(50000, 3600)), { status: 200 }));

    const res = await request(app.getHttpServer())
      .post('/api/orcamentos/budgets')
      .send({
        clientId: client._id,
        items: [{ serviceId: service._id, quantity: 1 }],
        destinationAddress: 'Rua Destino, 999',
      })
      .expect(201);

    expect(res.body.travelCost).toBe(100); // 50km * 2/km
    expect(res.body.total).toBe(1600);
  });

  it('PATCH /:id/status enforces the transition table', async () => {
    const { service, client } = await seedClientServiceCompany(app);
    const created = await request(app.getHttpServer())
      .post('/api/orcamentos/budgets')
      .send({ clientId: client._id, items: [{ serviceId: service._id, quantity: 1 }] })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/orcamentos/budgets/${created.body._id}/status`)
      .send({ status: 'APROVADO' })
      .expect(400);

    const sent = await request(app.getHttpServer())
      .patch(`/api/orcamentos/budgets/${created.body._id}/status`)
      .send({ status: 'ENVIADO' })
      .expect(200);
    expect(sent.body.status).toBe('ENVIADO');

    const approved = await request(app.getHttpServer())
      .patch(`/api/orcamentos/budgets/${created.body._id}/status`)
      .send({ status: 'APROVADO' })
      .expect(200);
    expect(approved.body.status).toBe('APROVADO');

    await request(app.getHttpServer())
      .patch(`/api/orcamentos/budgets/${created.body._id}/status`)
      .send({ status: 'ENVIADO' })
      .expect(400);
  });

  it('GET /stats/conversion reflects seeded budgets', async () => {
    const res = await request(app.getHttpServer()).get('/api/orcamentos/budgets/stats/conversion').expect(200);
    expect(res.body.total).toBeGreaterThan(0);
    expect(typeof res.body.conversionRate).toBe('number');
  });
});
