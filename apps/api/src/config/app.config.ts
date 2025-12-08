import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  shortCodeLength: parseInt(process.env.SHORT_CODE_LENGTH || '6', 10),
  rateLimitTtl: parseInt(process.env.RATE_LIMIT_TTL || '60000', 10), // 1 minute in ms
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 requests per TTL
}));
