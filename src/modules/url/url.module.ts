import { Module } from '@nestjs/common';
import { UrlController } from './url.controller';
import { UrlService } from './url.service';
import { AnalyticsModule } from '@modules/analytics/analytics.module';

@Module({
  imports: [AnalyticsModule],
  controllers: [UrlController],
  providers: [UrlService],
  exports: [UrlService],
})
export class UrlModule {}
