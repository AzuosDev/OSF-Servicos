import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { MongoMemoryServer } from 'mongodb-memory-server';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const uri = configService.get<string>('MONGODB_URI');

        if (uri && uri.trim()) {
          return { uri };
        }

        const mongoServer = await MongoMemoryServer.create();
        return { uri: mongoServer.getUri() };
      },
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot({ ttl: 60, limit: 100 }),
  ],
})
export class AppModule {}
