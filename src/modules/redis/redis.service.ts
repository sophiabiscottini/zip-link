import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private readonly cacheTtl: number;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('redis.url', 'redis://localhost:6379');
    this.cacheTtl = this.configService.get<number>('redis.cacheTtl', 86400);

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.client.on('connect', () => {
      this.logger.log('✨ Redis connection established ~');
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis connection error:', err);
    });

    this.client.connect().catch((err) => {
      this.logger.error('Failed to connect to Redis:', err);
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('👋 Redis connection closed');
  }

  /**
   * Get the Redis client instance
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Get a cached URL by short code
   * @param shortCode - The short code to look up
   * @returns The original URL or null if not found
   */
  async getCachedUrl(shortCode: string): Promise<string | null> {
    const key = this.buildCacheKey(shortCode);
    return this.client.get(key);
  }

  /**
   * Cache a URL with the configured TTL
   * @param shortCode - The short code
   * @param originalUrl - The original URL to cache
   */
  async cacheUrl(shortCode: string, originalUrl: string): Promise<void> {
    const key = this.buildCacheKey(shortCode);
    await this.client.setex(key, this.cacheTtl, originalUrl);
  }

  /**
   * Invalidate a cached URL
   * @param shortCode - The short code to invalidate
   */
  async invalidateCache(shortCode: string): Promise<void> {
    const key = this.buildCacheKey(shortCode);
    await this.client.del(key);
  }

  /**
   * Build the cache key for a short code
   * Following the pattern: short:<code>
   */
  private buildCacheKey(shortCode: string): string {
    return `short:${shortCode}`;
  }
}
