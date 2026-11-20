import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health <- Public')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Health Check' })
  check() {
    return this.health.liveness();
  }

  @Get('live')
  @ApiOperation({ summary: 'Health Live Check' })
  live() {
    return this.health.liveness();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Health Ready Check' })
  async ready() {
    return this.health.readiness();
  }
}
