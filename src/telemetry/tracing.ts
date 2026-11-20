/**
 * OpenTelemetry bootstrap.
 *
 * MUST be imported before anything else in main.ts. The SDK works by patching
 * modules as they are require()d, so any instrumented library (http, express,
 * ioredis, pg) loaded first is never traced.
 *
 * Spans go to the Jaeger collector's OTLP endpoint on the observability host.
 * Disabled unless OTEL_EXPORTER_OTLP_ENDPOINT is set, so local development and
 * tests are unaffected.
 */
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

let sdk: NodeSDK | undefined;

export function startTracing(): void {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  if (!endpoint) {
    return;
  }

  if (process.env.OTEL_DIAG === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
  }

  sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]:
        process.env.OTEL_SERVICE_NAME ?? 'giftfactory-api',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
        process.env.APP_ENV ?? 'development',
    }),

    // Handed to NodeSDK rather than wrapped in a BatchSpanProcessor here on
    // purpose. Constructing the processor ourselves pulls in
    // @opentelemetry/sdk-trace-base at the top level, while the exporter resolves
    // its own nested copy at a different version — and TypeScript then rejects
    // the two Span types as incompatible (`_spanContext` is private, so the
    // declarations are not structurally interchangeable).
    //
    // NodeSDK wraps this in a BatchSpanProcessor internally using its own
    // matching version, which sidesteps the duplicate entirely.
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),

    instrumentations: [
      getNodeAutoInstrumentations({
        // Health and metrics endpoints are polled every few seconds by the ALB
        // and Prometheus; tracing them buries the real traffic.
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (request: any) => {
            const url = request.url ?? '';
            return (
              url.startsWith('/api/v1/health') || url.startsWith('/api/v1/metrics')
            );
          },
        },
        // Noisy and rarely useful once the HTTP and DB spans are in place.
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();

  const shutdown = () => {
    sdk
      ?.shutdown()
      .catch((err: any) => console.error('[tracing] shutdown failed', err))
      .finally(() => process.exit(0));
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
