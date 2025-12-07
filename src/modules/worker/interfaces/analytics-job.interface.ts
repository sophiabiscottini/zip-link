/**
 * Interface for analytics job data sent to BullMQ queue
 */
export interface AnalyticsJobData {
  /** The short code of the URL that was accessed */
  shortCode: string;

  /** User agent string from the request */
  userAgent?: string;

  /** IP address of the client (will be hashed for privacy~) */
  ip?: string;

  /** Timestamp of the access */
  timestamp: string;

  /** Referer header from the request */
  referer?: string;
}
