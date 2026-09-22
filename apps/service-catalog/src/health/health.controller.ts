import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createHealthStatus, type HealthStatus } from '@solar/shared';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Aggregated health check' })
  check(): HealthStatus {
    return createHealthStatus('service-catalog');
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  ready(): { status: 'ok' } {
    return { status: 'ok' };
  }
}