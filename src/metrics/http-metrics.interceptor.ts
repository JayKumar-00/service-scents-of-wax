import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { isPlainHttpPath } from '../common/constants/observability';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (process.env.METRICS_ENABLED !== 'true') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const url = request.url ?? request.path ?? '';

    if (isPlainHttpPath(url)) {
      return next.handle();
    }

    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const route =
          request.route?.path ?? request.routerPath ?? url.split('?')[0];
        const labels = {
          method: request.method,
          route: String(route),
          status_code: String(response.statusCode ?? 200),
        };
        this.metrics.httpRequestsTotal.inc(labels);
        this.metrics.httpRequestDuration.observe(
          labels,
          (Date.now() - start) / 1000,
        );
      }),
    );
  }
}
