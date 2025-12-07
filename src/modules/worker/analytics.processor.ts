import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '@modules/prisma/prisma.service';
import { ANALYTICS_QUEUE } from '@common/constants/queues.constant';
import { AnalyticsJobData } from './interfaces/analytics-job.interface';
import { createHash } from 'crypto';

@Processor(ANALYTICS_QUEUE)
export class AnalyticsProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<AnalyticsJobData>): Promise<void> {
    const { shortCode, userAgent, ip, timestamp, referer } = job.data;

    this.logger.debug(`Processing analytics for: ${shortCode}`);

    try {
      // Find the URL record
      const url = await this.prisma.url.findUnique({
        where: { shortCode },
        select: { id: true },
      });

      if (!url) {
        this.logger.warn(`URL not found for short code: ${shortCode}`);
        return;
      }

      // Hash IP address for privacy (LGPD/GDPR compliance)
      const hashedIp = ip ? this.hashIpAddress(ip) : null;

      // Insert analytics record
      await this.prisma.analytics.create({
        data: {
          urlId: url.id,
          accessTime: new Date(timestamp),
          ipAddress: hashedIp,
          userAgent: userAgent || null,
          referer: referer || null,
          countryCode: null, // TODO: Implement GeoIP lookup
        },
      });

      this.logger.debug(`✨ Analytics recorded for: ${shortCode}`);
    } catch (error) {
      this.logger.error(`Failed to process analytics for ${shortCode}:`, error);
      throw error;
    }
  }

  /**
   * Hash IP address for privacy compliance
   * Uses SHA-256 with a salt to anonymize the IP
   */
  private hashIpAddress(ip: string): string {
    const salt = process.env.IP_HASH_SALT || 'nanolink-default-salt';
    return createHash('sha256').update(`${ip}${salt}`).digest('hex').substring(0, 64);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<AnalyticsJobData>) {
    this.logger.debug(`Job ${job.id} completed for: ${job.data.shortCode}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AnalyticsJobData>, error: Error) {
    this.logger.error(`Job ${job.id} failed for: ${job.data.shortCode}`, error.message);
  }
}
