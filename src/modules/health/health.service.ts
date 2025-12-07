import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { RedisService } from '@modules/redis/redis.service';

export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  services: {
    database: 'up' | 'down';
    cache: 'up' | 'down';
  };
}

export interface ReadinessStatus extends HealthStatus {
  ready: boolean;
}

export interface LivenessStatus {
  alive: boolean;
  timestamp: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthStatus> {
    const [dbStatus, cacheStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkCache(),
    ]);

    const allHealthy = dbStatus && cacheStatus;

    return {
      status: allHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: dbStatus ? 'up' : 'down',
        cache: cacheStatus ? 'up' : 'down',
      },
    };
  }

  async checkReadiness(): Promise<ReadinessStatus> {
    const health = await this.check();
    return {
      ready: health.status === 'ok',
      ...health,
    };
  }

  checkLiveness(): LivenessStatus {
    return {
      alive: true,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return false;
    }
  }

  private async checkCache(): Promise<boolean> {
    try {
      const client = this.redis.getClient();
      await client.ping();
      return true;
    } catch (error) {
      this.logger.error('Cache health check failed', error);
      return false;
    }
  }
}
