import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly register = new client.Registry();

  readonly httpRequestDuration: client.Histogram<string>;
  readonly httpRequestsTotal: client.Counter<string>;

  onModuleInit() {
    client.collectDefaultMetrics({ register: this.register });
  }

  constructor() {
    this.httpRequestDuration = new client.Histogram({
      name: 'giftfactory_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.register],
    });

    this.httpRequestsTotal = new client.Counter({
      name: 'giftfactory_http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
    });
  }

  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  getContentType(): string {
    return this.register.contentType;
  }
}
