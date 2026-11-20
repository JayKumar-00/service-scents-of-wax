import { Injectable, Logger } from '@nestjs/common';
import { DomainOutboxStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import {
  DOMAIN_OUTBOX_MAX_ATTEMPTS,
  domainOutboxBackoffMs,
} from './outbox.constants';
import { JwtUser } from 'src/auth/types/jwt-user.type';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { AuditService } from 'src/audit/audit.service';

export type EmitContext = {
  stockingNodeId?: string | null;
  productId?: string | null;
  variantId?: string | null;
  quantityDelta?: number | null;
  refType: string;
  refId?: string | null;
};

@Injectable()
export class DomainEventsService {
  private readonly logger = new Logger(DomainEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: WebhooksService,
    private readonly audit: AuditService,
  ) { }

  /**
   * Canonical supply-chain event: durable timeline row + outbox row + webhook dispatch to subscribers.
   */
  async emit(
    eventName: string,
    payload: Record<string, unknown>,
    ctx?: EmitContext,
  ): Promise<void> {
    await this.prisma.supplyChainEvent.create({
      data: {
        eventName,
        stockingNodeId: ctx?.stockingNodeId ?? undefined,
        productId: ctx?.productId ?? undefined,
        variantId: ctx?.variantId ?? undefined,
        quantityDelta: ctx?.quantityDelta ?? undefined,
        refType: ctx?.refType ?? 'domain',
        refId: ctx?.refId ?? undefined,
        payload: payload as Prisma.InputJsonValue,
      },
    });

    const out = await this.prisma.domainEventOutbox.create({
      data: {
        eventName,
        payload: payload as Prisma.InputJsonValue,
        status: DomainOutboxStatus.PENDING,
      },
    });

    try {
      await this.webhooks.queueEvent(eventName, payload);
      await this.prisma.domainEventOutbox.update({
        where: { id: out.id },
        data: {
          status: DomainOutboxStatus.DISPATCHED,
          dispatchedAt: new Date(),
          nextRetryAt: null,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(
        `Domain event ${eventName} webhook phase failed: ${msg}`,
      );
      const attemptsAfter = out.attempts + 1;
      const nextRetryAt = new Date(
        Date.now() + domainOutboxBackoffMs(attemptsAfter),
      );
      await this.prisma.domainEventOutbox.update({
        where: { id: out.id },
        data: {
          status: DomainOutboxStatus.FAILED,
          lastError: msg.slice(0, 2000),
          attempts: { increment: 1 },
          nextRetryAt,
        },
      });
    }
  }

  /** Re-queue webhook delivery for failed (or stuck pending) outbox rows. */
  async retryOutboxBatch(
    user: JwtUser,
    limit = 25,
    ip: string
  ): Promise<{ processed: number; succeeded: number; deadLettered: number }> {
    const lim = Math.min(Math.max(limit, 1), 100);
    const now = new Date();
    const rows = await this.prisma.domainEventOutbox.findMany({
      where: {
        status: { in: [DomainOutboxStatus.FAILED, DomainOutboxStatus.PENDING] },
        attempts: { lt: DOMAIN_OUTBOX_MAX_ATTEMPTS },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      orderBy: { createdAt: 'asc' },
      take: lim,
    });
    let succeeded = 0;
    let deadLettered = 0;
    for (const row of rows) {
      const payload = row.payload as Record<string, unknown>;
      try {
        await this.webhooks.queueEvent(row.eventName, payload);
        await this.prisma.domainEventOutbox.update({
          where: { id: row.id },
          data: {
            status: DomainOutboxStatus.DISPATCHED,
            dispatchedAt: new Date(),
            lastError: null,
            nextRetryAt: null,
          },
        });
        succeeded += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const nextAttempts = row.attempts + 1;
        if (nextAttempts >= DOMAIN_OUTBOX_MAX_ATTEMPTS) {
          await this.prisma.domainEventOutbox.update({
            where: { id: row.id },
            data: {
              status: DomainOutboxStatus.DEAD_LETTER,
              lastError: msg.slice(0, 2000),
              attempts: { increment: 1 },
              nextRetryAt: null,
            },
          });
          deadLettered += 1;
        } else {
          await this.prisma.domainEventOutbox.update({
            where: { id: row.id },
            data: {
              status: DomainOutboxStatus.FAILED,
              lastError: msg.slice(0, 2000),
              attempts: { increment: 1 },
              nextRetryAt: new Date(
                Date.now() + domainOutboxBackoffMs(nextAttempts),
              ),
            },
          });
        }
      }
    }

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'outbox.retry',
        resource: 'DomainOutbox',
        resourceId: null,
        metadata: {
          processed: rows.length,
          succeeded,
          failed: rows.length - succeeded - deadLettered,
          deadLettered,
          ids: rows.map(r => r.id),
        },
        ip,
      }),
      'outbox.retry',
    );

    return { processed: rows.length, succeeded, deadLettered };
  }
}
