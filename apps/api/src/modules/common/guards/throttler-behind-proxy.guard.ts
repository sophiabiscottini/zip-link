import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Custom ThrottlerGuard that handles requests behind a proxy
 * Extracts the real client IP from X-Forwarded-For header
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Try to get the real IP from proxy headers
    const forwardedFor = req.headers['x-forwarded-for'];
    
    if (forwardedFor) {
      // X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
      // The first one is the original client IP
      const ips = Array.isArray(forwardedFor) 
        ? forwardedFor[0] 
        : forwardedFor.split(',')[0];
      return ips.trim();
    }

    // Fallback to X-Real-IP header (used by some proxies like Nginx)
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Last resort: use the direct connection IP
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }

  /**
   * Skip rate limiting for health check endpoints
   */
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const path = request.url || request.path;
    
    // Skip rate limiting for health checks
    if (path.startsWith('/health')) {
      return true;
    }
    
    return false;
  }
}
