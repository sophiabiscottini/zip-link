import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@modules/prisma/prisma.service';
import { ANALYTICS_QUEUE } from '@common/constants/queues.constant';

export interface TrackClickData {
  shortCode: string;
  userAgent?: string;
  ip?: string;
  referer?: string;
}

export interface AnalyticsStats {
  shortCode: string;
  originalUrl: string;
  totalClicks: number;
  analytics: {
    clicksByDay: Array<{ date: string; count: number }>;
    recentClicks: Array<{
      accessTime: Date;
      countryCode: string | null;
    }>;
  };
}

interface ClicksByDayRow {
  date: string;
  count: bigint;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectQueue(ANALYTICS_QUEUE) private readonly analyticsQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Track a click event by adding a job to the analytics queue
   * This is called asynchronously after redirect to not impact latency
   */
  async trackClick(data: TrackClickData): Promise<void> {
    const { shortCode, userAgent, ip, referer } = data;

    try {
      await this.analyticsQueue.add(
        'track-click',
        {
          shortCode,
          userAgent,
          ip,
          referer,
          timestamp: new Date().toISOString(),
        },
        {
          removeOnComplete: true,
          removeOnFail: 1000, // Keep last 1000 failed jobs for debugging
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      );

      this.logger.debug(`📊 Click tracked for: ${shortCode}`);
    } catch (error) {
      // Log error but don't throw (analytics should not impact user experience)
      this.logger.error(`Failed to track click for ${shortCode}:`, error);
    }
  }

  /**
   * Get analytics statistics for a short code
   */
  async getStats(shortCode: string): Promise<AnalyticsStats> {
    // Find the URL and count analytics
    const url = await this.prisma.url.findUnique({
      where: { shortCode },
      include: {
        _count: {
          select: { analytics: true },
        },
      },
    });

    if (!url) {
      throw new NotFoundException('Short URL not found');
    }

    // Get clicks grouped by day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const clicksByDay = await this.prisma.$queryRaw<ClicksByDayRow[]>`
      SELECT 
        DATE(access_time) as date,
        COUNT(*) as count
      FROM analytics
      WHERE url_id = ${url.id}
        AND access_time >= ${thirtyDaysAgo}
      GROUP BY DATE(access_time)
      ORDER BY date DESC
    `;

    // Get recent clicks
    const recentClicks = await this.prisma.analytics.findMany({
      where: { urlId: url.id },
      orderBy: { accessTime: 'desc' },
      take: 10,
      select: {
        accessTime: true,
        countryCode: true,
      },
    });

    return {
      shortCode: url.shortCode,
      originalUrl: url.originalUrl,
      totalClicks: url._count.analytics,
      analytics: {
        clicksByDay: clicksByDay.map((row: ClicksByDayRow) => ({
          date: row.date,
          count: Number(row.count),
        })),
        recentClicks,
      },
    };
  }
}
