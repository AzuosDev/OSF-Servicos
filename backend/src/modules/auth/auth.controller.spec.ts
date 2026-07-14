import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { Model } from 'mongoose';
import { AuthModule } from './auth.module';
import { User, UserDocument } from '../users/schemas/user.schema';

async function buildApp(mongoUri: string): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      MongooseModule.forRootAsync({ useFactory: () => ({ uri: mongoUri }) }),
      ThrottlerModule.forRoot({ ttl: 60, limit: 100 }),
      AuthModule,
    ],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  await app.init();
  return app;
}

describe('AuthController - resend-verification (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let userModel: Model<UserDocument>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    app = await buildApp(mongod.getUri());
    userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  }, 60000);

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('gera um novo token de verificacao (invalidando o antigo) e bloqueia a segunda tentativa por rate limit', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'reenvio@teste.com', password: 'Senha123' })
      .expect(201);

    const before = await userModel.findOne({ email: 'reenvio@teste.com' }).exec();
    const oldToken = before!.emailVerificationToken;
    expect(oldToken).toBeTruthy();

    await request(app.getHttpServer())
      .post('/api/auth/resend-verification')
      .send({ email: 'reenvio@teste.com' })
      .expect(201);

    const after = await userModel.findOne({ email: 'reenvio@teste.com' }).exec();
    const newToken = after!.emailVerificationToken;
    expect(newToken).toBeTruthy();
    expect(newToken).not.toBe(oldToken);

    // token antigo não verifica mais
    await request(app.getHttpServer())
      .get('/api/auth/verify-email')
      .query({ token: oldToken })
      .expect(401);

    // token novo verifica normalmente
    const verifyRes = await request(app.getHttpServer())
      .get('/api/auth/verify-email')
      .query({ token: newToken })
      .expect(200);
    expect(verifyRes.body.accessToken).toBeTruthy();

    // segunda tentativa de reenvio em seguida (dentro da mesma janela de 60s) é bloqueada
    await request(app.getHttpServer())
      .post('/api/auth/resend-verification')
      .send({ email: 'reenvio@teste.com' })
      .expect(429);
  }, 20000);
});

describe('AuthController - resend-verification: email ja verificado (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let userModel: Model<UserDocument>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    app = await buildApp(mongod.getUri());
    userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  }, 60000);

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('retorna 400 ao tentar reenviar para um email ja verificado', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'javerificado@teste.com', password: 'Senha123' })
      .expect(201);

    await userModel.findOneAndUpdate({ email: 'javerificado@teste.com' }, { emailVerified: true }).exec();

    await request(app.getHttpServer())
      .post('/api/auth/resend-verification')
      .send({ email: 'javerificado@teste.com' })
      .expect(400);
  });
});
