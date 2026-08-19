import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { OrcamentosModule } from './orcamentos.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanySettings, CompanySettingsDocument } from './schemas/company-settings.schema';

const FAKE_USER_ID = new Types.ObjectId().toString();

describe('CompanySettingsController (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let companySettingsModel: Model<CompanySettingsDocument>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        MongooseModule.forRootAsync({ useFactory: () => ({ uri: mongod.getUri() }) }),
        OrcamentosModule,
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    companySettingsModel = app.get<Model<CompanySettingsDocument>>(getModelToken(CompanySettings.name));
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('GET returns null when nothing was configured yet', async () => {
    const res = await request(app.getHttpServer()).get('/api/orcamentos/company-settings').expect(200);
    expect(res.text).toBe('null');
  });

  const payload = {
    companyName: 'OSF Serviços',
    baseAddress: 'Rua Empresa, 1',
    pricePerKm: 2.5,
    minimumTravelFee: 30,
    freeRadiusKm: 10,
  };

  it('PUT creates the settings on first call', async () => {
    const res = await request(app.getHttpServer()).put('/api/orcamentos/company-settings').send(payload).expect(200);
    expect(res.body.companyName).toBe('OSF Serviços');
  });

  it('PUT twice does not create a duplicate document (unique index on userId)', async () => {
    await request(app.getHttpServer())
      .put('/api/orcamentos/company-settings')
      .send({ ...payload, pricePerKm: 3 })
      .expect(200);

    const count = await companySettingsModel.countDocuments({ userId: new Types.ObjectId(FAKE_USER_ID) }).exec();
    expect(count).toBe(1);

    const res = await request(app.getHttpServer()).get('/api/orcamentos/company-settings').expect(200);
    expect(res.body.pricePerKm).toBe(3);
  });
});
