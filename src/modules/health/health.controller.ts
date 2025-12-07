import { Controller, Get } from '@nestjs/common';
import { HealthService, HealthStatus, ReadinessStatus, LivenessStatus } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): Promise<HealthStatus> {
    return this.healthService.check();
  }

  @Get('ready')
  readiness(): Promise<ReadinessStatus> {
    return this.healthService.checkReadiness();
  }

  @Get('live')
  liveness(): LivenessStatus {
    return this.healthService.checkLiveness();
  }
}
