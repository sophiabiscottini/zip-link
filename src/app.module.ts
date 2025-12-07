import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { HealthModule } from '@modules/health/health.module';
import { UrlModule } from '@modules/url/url.module';
import { RedisModule } from '@modules/redis/redis.module';
import { PrismaModule } from '@modules/prisma/prisma.module';
import appConfig from '@config/app.config';
import redisConfig from '@config/redis.config';
import databaseConfig from '@config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, redisConfig, databaseConfig],
      envFilePath: ['.env', '.env.local'],
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host', 'localhost'),
          port: configService.get<number>('redis.port', 6379),
        },
      }),
      inject: [ConfigService],
    }),

    PrismaModule,
    RedisModule,

    HealthModule,
    UrlModule,
  ],
})
export class AppModule {}
