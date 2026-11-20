import { ConsoleLogger, LogLevel } from '@nestjs/common';
import { trace } from '@opentelemetry/api';

/**
 * Single-line JSON logger.
 *
 * Both log pipelines consume stdout: FireLens parses each line and fans it out
 * to Loki and Logstash. Nest's default ConsoleLogger emits coloured, multi-line,
 * human-shaped text, which arrives as one opaque `message` string with no level,
 * context, or correlation id to filter on.
 *
 * Every line also carries the active traceId/spanId, which is what makes the
 * Loki -> Jaeger and Jaeger -> Loki links in the Grafana datasources work.
 *
 * Set LOG_FORMAT=pretty (the default outside production) to keep the readable
 * console output while developing.
 */
export class JsonLogger extends ConsoleLogger {
  private static readonly LEVEL_BY_METHOD: Record<string, string> = {
    log: 'info',
    error: 'error',
    warn: 'warn',
    debug: 'debug',
    verbose: 'trace',
    fatal: 'fatal',
  };

  protected printMessages(
    messages: unknown[],
    context = '',
    logLevel: LogLevel = 'log',
    writeStreamType?: 'stdout' | 'stderr',
  ): void {
    const stream = writeStreamType === 'stderr' ? process.stderr : process.stdout;

    for (const message of messages) {
      stream.write(`${this.toJsonLine(message, context, logLevel)}\n`);
    }
  }

  private toJsonLine(
    message: unknown,
    context: string,
    logLevel: LogLevel,
  ): string {
    const span = trace.getActiveSpan()?.spanContext();

    const entry: Record<string, unknown> = {
      '@timestamp': new Date().toISOString(),
      level: JsonLogger.LEVEL_BY_METHOD[logLevel] ?? logLevel,
      context: context || undefined,
      service: process.env.OTEL_SERVICE_NAME ?? 'giftfactory-api',
      env: process.env.APP_ENV ?? 'development',
      // Present only inside a request; absent for boot-time lines.
      traceId: span?.traceId,
      spanId: span?.spanId,
    };

    if (message instanceof Error) {
      entry.message = message.message;
      entry.stack = message.stack;
      entry.errorName = message.name;
    } else if (typeof message === 'object' && message !== null) {
      Object.assign(entry, message);
      entry.message ??= JSON.stringify(message);
    } else {
      entry.message = String(message);
    }

    try {
      return JSON.stringify(entry);
    } catch {
      // Circular references must never take down the process.
      return JSON.stringify({
        '@timestamp': entry['@timestamp'],
        level: entry.level,
        message: '[unserialisable log payload]',
        context: entry.context,
      });
    }
  }
}

/** Structured logs in deployed environments, readable ones locally. */
export function createLogger(): ConsoleLogger {
  const format =
    process.env.LOG_FORMAT ??
    (process.env.NODE_ENV === 'production' ? 'json' : 'pretty');

  return format === 'json' ? new JsonLogger() : new ConsoleLogger();
}
