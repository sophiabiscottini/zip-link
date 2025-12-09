import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@modules/prisma/prisma.service';
import { ANALYTICS_QUEUE } from '@shared/common/constants/queues.constant';

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
    topCountries: Array<{ country: string; count: number }>;
    topBrowsers: Array<{ browser: string; count: number }>;
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

interface CountryRow {
  country_code: string | null;
  count: bigint;
}

interface BrowserRow {
  browser: string;
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

    // Get top countries (top 10)
    const topCountriesRaw = await this.prisma.$queryRaw<CountryRow[]>`
      SELECT 
        country_code,
        COUNT(*) as count
      FROM analytics
      WHERE url_id = ${url.id}
        AND country_code IS NOT NULL
      GROUP BY country_code
      ORDER BY count DESC
      LIMIT 10
    `;

    // Get top browsers (top 10) - parsed from user_agent
    const topBrowsersRaw = await this.prisma.$queryRaw<BrowserRow[]>`
      SELECT 
        CASE
          WHEN user_agent ILIKE '%Firefox%' THEN 'Firefox'
          WHEN user_agent ILIKE '%Edg/%' THEN 'Edge'
          WHEN user_agent ILIKE '%Chrome%' THEN 'Chrome'
          WHEN user_agent ILIKE '%Safari%' AND user_agent NOT ILIKE '%Chrome%' THEN 'Safari'
          WHEN user_agent ILIKE '%Opera%' OR user_agent ILIKE '%OPR/%' THEN 'Opera'
          WHEN user_agent ILIKE '%MSIE%' OR user_agent ILIKE '%Trident%' THEN 'Internet Explorer'
          WHEN user_agent ILIKE '%curl%' THEN 'curl'
          WHEN user_agent ILIKE '%PostmanRuntime%' THEN 'Postman'
          WHEN user_agent IS NULL THEN 'Unknown'
          ELSE 'Other'
        END as browser,
        COUNT(*) as count
      FROM analytics
      WHERE url_id = ${url.id}
      GROUP BY browser
      ORDER BY count DESC
      LIMIT 10
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
        topCountries: topCountriesRaw.map((row: CountryRow) => ({
          country: row.country_code || 'Unknown',
          count: Number(row.count),
        })),
        topBrowsers: topBrowsersRaw.map((row: BrowserRow) => ({
          browser: row.browser,
          count: Number(row.count),
        })),
        recentClicks,
      },
    };
  }
}
