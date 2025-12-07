import { Controller, Get, Param } from '@nestjs/common';
import { AnalyticsService, AnalyticsStats } from './analytics.service';

@Controller('api/v1/stats')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /api/v1/stats/:code
   * Get analytics statistics for a short URL
   */
  @Get(':code')
  async getStats(@Param('code') code: string): Promise<AnalyticsStats> {
    return this.analyticsService.getStats(code);
  }
}
