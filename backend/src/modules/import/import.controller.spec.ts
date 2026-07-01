import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ImportModule } from './import.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { WalletsModule } from '../wallets/wallets.module';
import { CategoriesModule } from '../categories/categories.module';
import { Transaction, TransactionType } from '../transactions/schemas/transaction.schema';
import { Wallet } from '../wallets/schemas/wallet.schema';

const FAKE_USER_ID = new Types.ObjectId().toString();

// Minimal valid OFX content (BB format)
const SAMPLE_OFX = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:UTF-8
CHARSET:NONE
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20260601000000[-3:BRT]</DTPOSTED>
            <TRNAMT>-30.00</TRNAMT>
            <FITID>TEST-001</FITID>
            <NAME>Pix - Enviado</NAME>
            <MEMO>01/06 PADARIA CENTRAL</MEMO>
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT</TRNTYPE>
            <DTPOSTED>20260602000000[-3:BRT]</DTPOSTED>
            <TRNAMT>1800.00</TRNAMT>
            <FITID>TEST-002</FITID>
            <NAME>Transferência recebida</NAME>
            <MEMO>02/06 SALARIO EMPRESA XYZ</MEMO>
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>00021130000000[-3:BRT]</DTPOSTED>
            <TRNAMT>-0.14</TRNAMT>
            <FITID></FITID>
            <NAME>Saldo do dia</NAME>
            <MEMO></MEMO>
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

describe('ImportController (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let transactionModel: Model<Transaction>;
  let walletModel: Model<Wallet>;
  let walletId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRootAsync({ useFactory: () => ({ uri: mongod.getUri() }) }),
        ImportModule,
        TransactionsModule,
        WalletsModule,
        CategoriesModule,
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    transactionModel = app.get<Model<Transaction>>(getModelToken(Transaction.name));
    walletModel = app.get<Model<Wallet>>(getModelToken(Wallet.name));

    const wallet = await walletModel.create({
      userId: new Types.ObjectId(FAKE_USER_ID),
      nome: 'Banco do Brasil',
      saldo: 0,
    });
    walletId = wallet._id.toString();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  afterEach(async () => {
    await transactionModel.deleteMany({ userId: new Types.ObjectId(FAKE_USER_ID) });
  });

  it('preview: filtra "Saldo do dia" (data inválida) e retorna 2 candidatos', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/import/ofx/preview')
      .field('carteiraId', walletId)
      .attach('file', Buffer.from(SAMPLE_OFX), { filename: 'extrato.ofx', contentType: 'application/octet-stream' })
      .expect(201);

    const candidates: Array<{ type: string; value: number; fitId: string; description: string }> = res.body;
    expect(candidates).toHaveLength(2);
  });

  it('preview: sinal correto — TRNTYPE DEBIT → EXPENSE, CREDIT → INCOME', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/import/ofx/preview')
      .field('carteiraId', walletId)
      .attach('file', Buffer.from(SAMPLE_OFX), { filename: 'extrato.ofx', contentType: 'application/octet-stream' })
      .expect(201);

    const candidates: Array<{ type: string; value: number }> = res.body;
    const debit = candidates.find((c) => c.value === 30.00);
    const credit = candidates.find((c) => c.value === 1800.00);

    expect(debit?.type).toBe(TransactionType.EXPENSE);
    expect(credit?.type).toBe(TransactionType.INCOME);
  });

  it('confirm: importa 2 transações e atualiza saldo da carteira', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/import/ofx/confirm')
      .send({
        carteiraId: walletId,
        transactions: [
          { fitId: 'TEST-001', date: '2026-06-01', value: 30.00, type: TransactionType.EXPENSE, description: 'Padaria Central' },
          { fitId: 'TEST-002', date: '2026-06-02', value: 1800.00, type: TransactionType.INCOME, description: 'Salario' },
        ],
      })
      .expect(201);

    expect(res.body).toEqual({ imported: 2, skipped: 0 });

    const wallet = await walletModel.findById(walletId);
    // INCOME 1800 - EXPENSE 30 = 1770
    expect(wallet!.saldo).toBe(1770);
  });

  it('confirm: reimportar o mesmo arquivo não duplica transações (dedup por fitId)', async () => {
    const payload = {
      carteiraId: walletId,
      transactions: [
        { fitId: 'DEDUP-001', date: '2026-06-01', value: 50.00, type: TransactionType.EXPENSE, description: 'Teste dedup' },
      ],
    };

    // Primeira importação
    const first = await request(app.getHttpServer())
      .post('/api/import/ofx/confirm')
      .send(payload)
      .expect(201);
    expect(first.body).toEqual({ imported: 1, skipped: 0 });

    // Segunda importação com mesmo fitId → deve pular
    const second = await request(app.getHttpServer())
      .post('/api/import/ofx/confirm')
      .send(payload)
      .expect(201);
    expect(second.body).toEqual({ imported: 0, skipped: 1 });

    // Confirma que só existe 1 transação no banco
    const count = await transactionModel.countDocuments({
      userId: new Types.ObjectId(FAKE_USER_ID),
      fitId: 'DEDUP-001',
    });
    expect(count).toBe(1);
  });

  it('preview: marca alreadyImported=true para fitId já existente no banco', async () => {
    // Cria transação com fitId TEST-001 no banco
    await transactionModel.create({
      userId: new Types.ObjectId(FAKE_USER_ID),
      type: TransactionType.EXPENSE,
      value: 30,
      date: new Date('2026-06-01'),
      carteiraId: new Types.ObjectId(walletId),
      fitId: 'TEST-001',
    });

    const res = await request(app.getHttpServer())
      .post('/api/import/ofx/preview')
      .field('carteiraId', walletId)
      .attach('file', Buffer.from(SAMPLE_OFX), { filename: 'extrato.ofx', contentType: 'application/octet-stream' })
      .expect(201);

    const candidates: Array<{ fitId: string; alreadyImported: boolean }> = res.body;
    const existing = candidates.find((c) => c.fitId === 'TEST-001');
    expect(existing?.alreadyImported).toBe(true);

    const other = candidates.find((c) => c.fitId === 'TEST-002');
    expect(other?.alreadyImported).toBe(false);
  });
});
