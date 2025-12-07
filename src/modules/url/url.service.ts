import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@modules/prisma/prisma.service';
import { RedisService } from '@modules/redis/redis.service';
import { CreateUrlDto, UrlResponseDto } from './dto';
import { encodeBase62, padBase62 } from '@common/utils/base62.util';

@Injectable()
export class UrlService {
  private readonly logger = new Logger(UrlService.name);
  private readonly baseUrl: string;
  private readonly shortCodeLength: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('app.baseUrl', 'http://localhost:3000');
    this.shortCodeLength = this.configService.get<number>('app.shortCodeLength', 6);
  }

  /**
   * Create a new shortened URL
   * Uses custom alias if provided, otherwise generates from ID using Base62
   */
  async createShortUrl(dto: CreateUrlDto): Promise<UrlResponseDto> {
    const { url, customAlias } = dto;

    // If custom alias is provided, try to use it
    if (customAlias) {
      return this.createWithCustomAlias(url, customAlias);
    }

    // Otherwise, create with auto-generated short code
    return this.createWithAutoCode(url);
  }

  /**
   * Get the original URL by short code (with cache-aside pattern)
   * Returns the original URL for redirection
   */
  async getOriginalUrl(shortCode: string): Promise<string> {
    // Step 1: Check Redis cache first
    const cachedUrl = await this.redis.getCachedUrl(shortCode);

    if (cachedUrl) {
      this.logger.debug(`Cache HIT for: ${shortCode}`);
      return cachedUrl;
    }

    this.logger.debug(`Cache MISS for: ${shortCode}`);

    // Step 2: Query database on cache miss
    const urlRecord = await this.prisma.url.findUnique({
      where: { shortCode },
    });

    if (!urlRecord) {
      throw new NotFoundException('Short URL not found');
    }

    // Step 3: Populate cache for future requests
    await this.redis.cacheUrl(shortCode, urlRecord.originalUrl);

    return urlRecord.originalUrl;
  }

  /**
   * Get URL info (metadata) by short code
   */
  async getUrlInfo(shortCode: string): Promise<UrlResponseDto> {
    const urlRecord = await this.prisma.url.findUnique({
      where: { shortCode },
    });

    if (!urlRecord) {
      throw new NotFoundException('Short URL not found');
    }

    return this.toResponseDto(urlRecord);
  }

  /**
   * Create URL with custom alias
   * Uses database UNIQUE constraint to handle race conditions
   */
  private async createWithCustomAlias(url: string, customAlias: string): Promise<UrlResponseDto> {
    try {
      const urlRecord = await this.prisma.url.create({
        data: {
          originalUrl: url,
          shortCode: customAlias,
        },
      });

      this.logger.log(`Created short URL with custom alias: ${customAlias}`);
      return this.toResponseDto(urlRecord);
    } catch (error: unknown) {
      // Handle unique constraint violation (Postgres error 23505)
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          `The alias "${customAlias}" is already taken. Please choose another one.`,
        );
      }
      throw error;
    }
  }

  /**
   * Create URL with auto-generated Base62 code
   * Creates record first, then updates with encoded ID
   */
  private async createWithAutoCode(url: string): Promise<UrlResponseDto> {
    // First, create with a temporary placeholder to get the ID
    const urlRecord = await this.prisma.url.create({
      data: {
        originalUrl: url,
        shortCode: `temp_${Date.now()}`, // Temporary placeholder
      },
    });

    // Generate short code from ID using Base62
    const shortCode = padBase62(encodeBase62(urlRecord.id), this.shortCodeLength);

    // Update with the actual short code
    const updatedRecord = await this.prisma.url.update({
      where: { id: urlRecord.id },
      data: { shortCode },
    });

    this.logger.log(`Created short URL: ${shortCode} -> ${url}`);
    return this.toResponseDto(updatedRecord);
  }

  /**
   * Check if error is a Prisma unique constraint violation
   */
  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    );
  }

  /**
   * Convert database record to response DTO
   */
  private toResponseDto(record: { id: number; originalUrl: string; shortCode: string; createdAt: Date }): UrlResponseDto {
    return {
      shortUrl: `${this.baseUrl}/${record.shortCode}`,
      shortCode: record.shortCode,
      originalUrl: record.originalUrl,
      createdAt: record.createdAt,
    };
  }
}
