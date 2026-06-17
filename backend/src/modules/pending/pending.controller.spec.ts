import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PendingModule } from './pending.module';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';

describe('PendingController (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let mongoUri: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    mongoUri = mongod.getUri();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRootAsync({
          useFactory: () => ({ uri: mongoUri }),
        }),
        PendingModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  const validPayload = {
    title: 'Compra teste',
    value: 1000,
    dueDate: '2026-12-31',
    categoria: 'Alimentação',
    formatoPagamento: 'Cartão de Crédito',
    isParcelada: true,
    parcelas: {
      totalParcelas: 4,
      parcelasPayas: 0,
      dataInicio: '2026-01-01',
      dataFim: '2026-04-01',
    },
    isRecorrente: true,
    recorrencia: {
      periodoRecorrencia: 'MONTHLY',
      dataProxima: '2026-01-01',
    },
  };

  it('POST creates pending with calculated valorParcela', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/pending')
      .send(validPayload)
      .expect(201);
    expect(res.body.parcelas.valorParcela).toBe(250); // 1000/4
    expect(res.body.isParcelada).toBe(true);
    expect(res.body.isRecorrente).toBe(true);
  });

  it('POST returns 400 when isParcelada true without parcelas', async () => {
    const { parcelas, ...rest } = validPayload;
    await request(app.getHttpServer())
      .post('/api/pending')
      .send({ ...rest, isParcelada: true })
      .expect(400);
  });

  it('PATCH updates isRecorrente false -> true requires recorrencia', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/pending')
      .send({ ...validPayload, isRecorrente: false })
      .expect(201);
    const id = create.body._id;
    await request(app.getHttpServer())
      .patch(`/api/pending/${id}`)
      .send({ isRecorrente: true })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/pending/${id}`)
      .send({ isRecorrente: true, recorrencia: { periodoRecorrencia: 'WEEKLY', dataProxima: '2026-02-01' } })
      .expect(200);
  });
});
