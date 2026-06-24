import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { PendingModule } from './pending.module';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

const FAKE_USER_ID = new Types.ObjectId().toString();

describe('PendingController (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const mongoUri = mongod.getUri();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRootAsync({
          useFactory: () => ({ uri: mongoUri }),
        }),
        PendingModule,
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
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  const basePayload = {
    title: 'Compra teste',
    value: 1000,
    dueDate: '2026-12-31',
    categoria: 'Alimentação',
    formatoPagamento: 'Cartão de Crédito',
  };

  it('POST creates pending with calculated valorParcela', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/pending')
      .send({
        ...basePayload,
        isParcelada: true,
        parcelas: {
          totalParcelas: 4,
          dataInicio: '2026-01-01',
          dataFim: '2026-04-01',
        },
      })
      .expect(201);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].parcelas.valorParcela).toBe(250); // 1000/4
    expect(res.body[0].isParcelada).toBe(true);
  });

  it('POST returns 400 when isParcelada true without parcelas', async () => {
    await request(app.getHttpServer())
      .post('/api/pending')
      .send({ ...basePayload, isParcelada: true })
      .expect(400);
  });

  it('PATCH updates isRecorrente false -> true requires recorrencia', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/pending')
      .send({ ...basePayload, isRecorrente: false })
      .expect(201);
    const id = (create.body as { _id: string })._id;
    await request(app.getHttpServer())
      .patch(`/api/pending/${id}`)
      .send({ isRecorrente: true })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/pending/${id}`)
      .send({ isRecorrente: true, recorrencia: { periodoRecorrencia: 'Mensal', dataProxima: '2026-02-01' } })
      .expect(200);
  });
});
