import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { PendingModule } from './pending.module';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Category } from '../categories/schemas/category.schema';
import { Transaction } from '../transactions/schemas/transaction.schema';

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
      .post('/api/accounts')
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
      .post('/api/accounts')
      .send({ ...basePayload, isParcelada: true })
      .expect(400);
  });

  it('PATCH updates isRecorrente false -> true requires recorrencia', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/accounts')
      .send({ ...basePayload, isRecorrente: false })
      .expect(201);
    const id = (create.body as { _id: string })._id;
    await request(app.getHttpServer())
      .patch(`/api/accounts/${id}`)
      .send({ isRecorrente: true })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/accounts/${id}`)
      .send({ isRecorrente: true, recorrencia: { periodoRecorrencia: 'Mensal', dataProxima: '2026-02-01' } })
      .expect(200);
  });

  it('GET filters by tipo (PAGAR vs RECEBER)', async () => {
    await request(app.getHttpServer())
      .post('/api/accounts')
      .send({ ...basePayload, title: 'Conta a receber teste', tipo: 'RECEBER' })
      .expect(201);

    const pagarRes = await request(app.getHttpServer())
      .get('/api/accounts')
      .query({ tipo: 'PAGAR' })
      .expect(200);
    expect(
      (pagarRes.body as Array<{ title: string }>).some((item) => item.title === 'Conta a receber teste'),
    ).toBe(false);

    const receberRes = await request(app.getHttpServer())
      .get('/api/accounts')
      .query({ tipo: 'RECEBER' })
      .expect(200);
    expect(
      (receberRes.body as Array<{ title: string }>).some((item) => item.title === 'Conta a receber teste'),
    ).toBe(true);
  });

  it('GET projects recurring PAGAR/RECEBER for the whole target month regardless of today', async () => {
    // Template vence todo dia 5, criado em janeiro/2026.
    await request(app.getHttpServer())
      .post('/api/accounts')
      .send({
        ...basePayload,
        title: 'Aluguel recorrente',
        dueDate: '2026-01-05',
        isRecorrente: true,
        tipo: 'PAGAR',
        recorrencia: { periodoRecorrencia: 'Mensal', dataProxima: '2026-01-05' },
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/accounts')
      .send({
        ...basePayload,
        title: 'Salário recorrente',
        dueDate: '2026-01-05',
        isRecorrente: true,
        tipo: 'RECEBER',
        recorrencia: { periodoRecorrencia: 'Mensal', dataProxima: '2026-01-05' },
      })
      .expect(201);

    // Consulta o mês 06/2026 (independentemente de qual seja o dia "hoje" no relógio do servidor,
    // a conta deve aparecer o mês inteiro, não só no dia 5).
    const pagarRes = await request(app.getHttpServer())
      .get('/api/accounts')
      .query({ tipo: 'PAGAR', month: 6, year: 2026 })
      .expect(200);
    const aluguel = (pagarRes.body as Array<{ title: string; dueDate: string }>).find(
      (item) => item.title === 'Aluguel recorrente',
    );
    expect(aluguel).toBeDefined();
    expect(new Date(aluguel!.dueDate).getUTCDate()).toBe(5);
    expect(new Date(aluguel!.dueDate).getUTCMonth()).toBe(5); // 0-indexed: junho

    const receberRes = await request(app.getHttpServer())
      .get('/api/accounts')
      .query({ tipo: 'RECEBER', month: 6, year: 2026 })
      .expect(200);
    const salario = (receberRes.body as Array<{ title: string; dueDate: string }>).find(
      (item) => item.title === 'Salário recorrente',
    );
    expect(salario).toBeDefined();
    expect(new Date(salario!.dueDate).getUTCDate()).toBe(5);
  });

  it('PATCH paid=true on a RECEBER account creates an INCOME transaction with category fallback', async () => {
    const categoryModel = app.get<Model<Category>>(getModelToken(Category.name));
    const transactionModel = app.get<Model<Transaction>>(getModelToken(Transaction.name));

    const incomeCategory = await categoryModel.create({
      name: 'Salário Teste',
      slug: 'salario-teste',
      isIncome: true,
      isDefault: true,
    });

    const create = await request(app.getHttpServer())
      .post('/api/accounts')
      .send({
        ...basePayload,
        title: 'Recebimento de cliente',
        tipo: 'RECEBER',
        categoria: 'Categoria Que Não Existe',
      })
      .expect(201);
    const id = (create.body as { _id: string })._id;

    await request(app.getHttpServer())
      .patch(`/api/accounts/${id}`)
      .send({ paid: true })
      .expect(200);

    const tx = await transactionModel.findOne({ pendingAccountId: new Types.ObjectId(id) }).exec();
    expect(tx).not.toBeNull();
    expect(tx!.type).toBe('INCOME');
    expect(tx!.categoryId?.toString()).toBe(incomeCategory._id.toString());
  });

  it('DELETE /:templateId/month removes a RECEBER recurring item from that month for good', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/accounts')
      .send({
        ...basePayload,
        title: 'Mensalidade recorrente RECEBER',
        dueDate: '2026-02-10',
        isRecorrente: true,
        tipo: 'RECEBER',
        recorrencia: { periodoRecorrencia: 'Mensal', dataProxima: '2026-02-10' },
      })
      .expect(201);
    const templateId = (create.body as { _id: string })._id;

    // Antes de pular: a conta deve aparecer na projeção de julho/2026.
    const beforeSkip = await request(app.getHttpServer())
      .get('/api/accounts')
      .query({ tipo: 'RECEBER', month: 7, year: 2026 })
      .expect(200);
    expect(
      (beforeSkip.body as Array<{ title: string }>).some(
        (item) => item.title === 'Mensalidade recorrente RECEBER',
      ),
    ).toBe(true);

    // Exclui apenas o mês de julho/2026.
    await request(app.getHttpServer())
      .delete(`/api/accounts/${templateId}/month`)
      .query({ month: 7, year: 2026 })
      .expect(200);

    // Depois de pular: não pode mais aparecer nem ser somada ao total de julho/2026.
    const afterSkip = await request(app.getHttpServer())
      .get('/api/accounts')
      .query({ tipo: 'RECEBER', month: 7, year: 2026 })
      .expect(200);
    const stillThere = (afterSkip.body as Array<{ title: string }>).some(
      (item) => item.title === 'Mensalidade recorrente RECEBER',
    );
    expect(stillThere).toBe(false);

    // Outros meses continuam projetando normalmente (só julho foi pulado).
    const otherMonth = await request(app.getHttpServer())
      .get('/api/accounts')
      .query({ tipo: 'RECEBER', month: 8, year: 2026 })
      .expect(200);
    expect(
      (otherMonth.body as Array<{ title: string }>).some(
        (item) => item.title === 'Mensalidade recorrente RECEBER',
      ),
    ).toBe(true);
  });

  it('GET keeps projecting a recurring PAGAR template into months well after its creation month', async () => {
    await request(app.getHttpServer())
      .post('/api/accounts')
      .send({
        ...basePayload,
        title: 'Assinatura criada em junho',
        dueDate: '2026-06-10',
        isRecorrente: true,
        tipo: 'PAGAR',
        recorrencia: { periodoRecorrencia: 'Mensal', dataProxima: '2026-06-10' },
      })
      .expect(201);

    for (const { month, year } of [
      { month: 7, year: 2026 },
      { month: 9, year: 2026 },
      { month: 12, year: 2026 },
    ]) {
      const res = await request(app.getHttpServer())
        .get('/api/accounts')
        .query({ tipo: 'PAGAR', month, year })
        .expect(200);
      const found = (res.body as Array<{ title: string }>).some(
        (item) => item.title === 'Assinatura criada em junho',
      );
      expect(found).toBe(true);
    }
  });
});
