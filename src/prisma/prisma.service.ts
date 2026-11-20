import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

type PrismaDelegateClient = PrismaClient;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private writer: PrismaClient;
  private reader: PrismaClient;

  constructor(private readonly config: ConfigService) {
    this.writer = new PrismaClient({
      datasources: { db: { url: this.config.get<string>('WRITER_DB_URL') } },
      transactionOptions: {
        maxWait: 10000,
        timeout: 30000,
      },
    });

    this.reader = new PrismaClient({
      datasources: { db: { url: this.config.get<string>('READER_DB_URL') } },
    });

    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (prop === 'model') {
          return target.model;
        }

        if (Reflect.has(target, prop)) {
          const value = Reflect.get(target, prop, receiver);
          return typeof value === 'function' ? value.bind(target) : value;
        }

        const writerModel = (target.writer as any)[prop];
        const readerModel = (target.reader as any)[prop];

        if (typeof writerModel === 'function') {
          return writerModel.bind(target.writer);
        }

        if (!writerModel) return undefined;

        return new Proxy(writerModel, {
          get: (_modelTarget, operation: string) => {
            const READ_OPS = [
              'findUnique',
              'findUniqueOrThrow',
              'findFirst',
              'findFirstOrThrow',
              'findMany',
              'count',
              'aggregate',
              'groupBy',
            ];

            if (READ_OPS.includes(operation)) {
              return this.bindDelegateOperation(
                readerModel,
                operation,
                writerModel,
              );
            }

            return this.bindDelegateOperation(
              writerModel,
              operation,
              readerModel,
            );
          },
        });
      },
    }) as any;
  }

  private async connectWithRetry(client: PrismaClient, name: string) {
    const maxAttempts = 10;
    const baseDelayMs = 3000;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await client.$connect();
        return;
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }

        const delayMs = Math.min(baseDelayMs * attempt, 15000);
        console.warn(
          `[prisma] ${name} connection failed on attempt ${attempt}/${maxAttempts}; retrying in ${delayMs}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  private bindDelegateOperation(
    delegate: Record<string, any> | undefined,
    operation: PropertyKey,
    fallbackDelegate?: Record<string, any>,
  ) {
    const fn = delegate?.[operation as keyof typeof delegate];
    if (typeof fn === 'function') {
      return fn.bind(delegate);
    }

    const fallbackFn =
      fallbackDelegate?.[operation as keyof typeof fallbackDelegate];
    if (typeof fallbackFn === 'function') {
      return fallbackFn.bind(fallbackDelegate);
    }

    return undefined;
  }

  get model() {
    return new Proxy(this.writer, {
      get: (_target, prop) => {
        const writerModel = (this.writer as any)[prop];
        const readerModel = (this.reader as any)[prop];

        if (typeof writerModel === 'function') {
          return writerModel.bind(this.writer);
        }

        if (!writerModel) return undefined;

        return new Proxy(writerModel, {
          get: (_modelTarget, operation: string) => {
            const READ_OPS = [
              'findUnique',
              'findUniqueOrThrow',
              'findFirst',
              'findFirstOrThrow',
              'findMany',
              'count',
              'aggregate',
              'groupBy',
            ];

            if (READ_OPS.includes(operation)) {
              return this.bindDelegateOperation(
                readerModel,
                operation,
                writerModel,
              );
            }

            return this.bindDelegateOperation(
              writerModel,
              operation,
              readerModel,
            );
          },
        });
      },
    });
  }

  async onModuleInit() {
    await Promise.all([
      this.connectWithRetry(this.writer, 'writer'),
      this.connectWithRetry(this.reader, 'reader'),
    ]);
  }

  async onModuleDestroy() {
    await Promise.all([this.writer.$disconnect(), this.reader.$disconnect()]);
  }
}

export interface PrismaService extends PrismaDelegateClient {}
