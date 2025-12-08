import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from '@modules/health/health.module';
import { UrlModule } from '@modules/url/url.module';
import { RedisModule } from '@modules/redis/redis.module';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { ThrottlerBehindProxyGuard } from '@modules/common/guards/throttler-behind-proxy.guard';
import appConfig from '@config/app.config';
import redisConfig from '@config/redis.config';
import databaseConfig from '@config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, redisConfig, databaseConfig],
      envFilePath: ['../../.env', '../../.env.local'],
    }),

    // Rate limiting: 100 requests per minute per IP
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: configService.get<number>('app.rateLimitTtl', 60000), // 1 minute in ms
            limit: configService.get<number>('app.rateLimitMax', 100), // 100 requests
          },
        ],
      }),
      inject: [ConfigService],
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
  providers: [
    // Apply rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
  ],
})
export class AppModule {}
