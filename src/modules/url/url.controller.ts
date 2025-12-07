import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
  Req,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { UrlService } from './url.service';
import { AnalyticsService } from '@modules/analytics/analytics.service';
import { CreateUrlDto } from './dto';

@Controller()
export class UrlController {
  constructor(
    private readonly urlService: UrlService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  /**
   * POST /api/v1/shorten
   * Create a new shortened URL
   */
  @Post('api/v1/shorten')
  @HttpCode(HttpStatus.CREATED)
  async createShortUrl(@Body() dto: CreateUrlDto) {
    return this.urlService.createShortUrl(dto);
  }

  /**
   * GET /:code
   * Redirect to the original URL
   * This is the main entry point for shortened URLs
   */
  @Get(':code')
  async redirect(
    @Param('code') code: string,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const originalUrl = await this.urlService.getOriginalUrl(code);

    // Track click asynchronously (fire and forget)
    // This does not block the redirect response
    this.analyticsService.trackClick({
      shortCode: code,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
      referer: request.headers['referer'],
    });

    // Use 301 (Permanent Redirect) for SEO benefits
    // Use 302 if you want to track all clicks or change destinations
    return reply.status(HttpStatus.MOVED_PERMANENTLY).redirect(originalUrl);
  }

  /**
   * GET /api/v1/urls/:code
   * Get URL information (without redirecting)
   */
  @Get('api/v1/urls/:code')
  async getUrlInfo(@Param('code') code: string) {
    return this.urlService.getUrlInfo(code);
  }
}
