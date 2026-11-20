import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get()
  async scrape(@Res() res: Response) {
    if (process.env.METRICS_ENABLED !== 'true') {
      res.status(404).type('text/plain').send('metrics disabled');
      return;
    }
    res
      .status(200)
      .type(this.metrics.getContentType())
      .send(await this.metrics.getMetrics());
  }
}
