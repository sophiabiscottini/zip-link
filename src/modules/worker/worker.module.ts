import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { AnalyticsProcessor } from './analytics.processor';
import { ANALYTICS_QUEUE } from '@common/constants/queues.constant';
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
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    BullModule.registerQueue({
      name: ANALYTICS_QUEUE,
    }),
    PrismaModule,
  ],
  providers: [AnalyticsProcessor],
})
export class WorkerModule {}
