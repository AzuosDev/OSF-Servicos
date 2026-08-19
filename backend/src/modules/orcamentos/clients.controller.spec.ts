import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types } from 'mongoose';
import { OrcamentosModule } from './orcamentos.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

const FAKE_USER_ID = new Types.ObjectId().toString();
const OTHER_USER_ID = new Types.ObjectId().toString();

const guardFor = (userId: string) => ({
  canActivate: (context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest();
    req.user = { _id: new Types.ObjectId(userId) };
    return true;
  },
});

describe('ClientsController (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), MongooseModule.forRootAsync({ useFactory: () => ({ uri: mongod.getUri() }) }), OrcamentosModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(guardFor(FAKE_USER_ID))
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('POST creates a client', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/orcamentos/clients')
      .send({ name: 'João Silva', address: 'Rua A, 100' })
      .expect(201);

    expect(res.body.name).toBe('João Silva');
    expect(res.body.active).toBe(true);
  });

  it('GET lists only clients for the current user', async () => {
    const res = await request(app.getHttpServer()).get('/api/orcamentos/clients').expect(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /:id returns 404 for a client belonging to another user', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/orcamentos/clients')
      .send({ name: 'Cliente Isolado', address: 'Rua B, 200' })
      .expect(201);

    const otherModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), MongooseModule.forRootAsync({ useFactory: () => ({ uri: mongod.getUri() }) }), OrcamentosModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(guardFor(OTHER_USER_ID))
      .compile();
    const otherApp = otherModule.createNestApplication();
    await otherApp.init();

    await request(otherApp.getHttpServer()).get(`/api/orcamentos/clients/${created.body._id}`).expect(404);
    await otherApp.close();
  });

  it('PATCH updates a client', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/orcamentos/clients')
      .send({ name: 'Maria Souza', address: 'Rua C, 300' })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/api/orcamentos/clients/${created.body._id}`)
      .send({ phone: '11988887777' })
      .expect(200);

    expect(updated.body.phone).toBe('11988887777');
  });

  it('DELETE removes a client', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/orcamentos/clients')
      .send({ name: 'Cliente Removível', address: 'Rua D, 400' })
      .expect(201);

    await request(app.getHttpServer()).delete(`/api/orcamentos/clients/${created.body._id}`).expect(200);
    await request(app.getHttpServer()).get(`/api/orcamentos/clients/${created.body._id}`).expect(404);
  });
});
