import { createHmac } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { WebhookDeliveryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookEndpointQueryDto } from './dto/webhook-endpoint-query.dto';
import { WebhookDeliveryQueryDto } from './dto/webhook-delivery-query.dto';
import { RedisService } from 'src/redis/redis.service';
import { AuditService } from 'src/audit/audit.service';
import { fireAndForget } from 'src/common/utils/fireForgot.util';
import { JwtUser } from 'src/auth/types/jwt-user.type';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly audit: AuditService,
  ) {}

  private matchesEvents(csv: string, event: string): boolean {
    const s = csv.trim();
    if (!s || s === '*') return true;
    return s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .includes(event);
  }

  async listEndpoints(query: WebhookEndpointQueryDto) {
    const cacheKey = `webhooks:endpoints:list:${JSON.stringify(query)}`;
    try {
      const cached = await this.redisService.get<any>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (e) {
      // Ignored for production resilience
    }

    const {
      page = 1,
      limit = 10,
      search,
      active,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { label: { contains: search, mode: 'insensitive' } },
        { url: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (active !== undefined) {
      where.active = active;
    }

    const [items, total] = await Promise.all([
      this.prisma.webhookEndpoint.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { _count: { select: { deliveries: true } } },
      }),
      this.prisma.webhookEndpoint.count({ where }),
    ]);

    const result = {
      data: items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };

    fireAndForget(
      this.redisService.set(cacheKey, result, 300),
      'cache webhooks list',
    );

    return result;
  }

  async createEndpoint(
    user: JwtUser,
    data: {
      label?: string;
      url: string;
      secret?: string;
      events?: string;
      active?: boolean;
    },
    ip: string,
  ) {
    const result = await this.prisma.webhookEndpoint.create({
      data: {
        label: data.label?.trim() || null,
        url: data.url.trim(),
        secret: data.secret?.trim() || null,
        events: data.events?.trim() || '*',
        active: data.active ?? true,
      },
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'webhook_endpoint.create',
        resource: 'WebhookEndpoint',
        resourceId: result.id,
        metadata: {
          role: user.role,
          label: result.label,
          url: result.url,
          events: result.events,
          active: result.active,
        },
        ip,
      }),
      'audit webhook endpoint creation',
    );

    fireAndForget(
      this.redisService.clearCacheByPrefix('webhooks:endpoints:list:'),
      'clear webhooks list cache',
    );

    return result;
  }

  async updateEndpoint(
    user: JwtUser,
    id: string,
    data: {
      label?: string;
      url?: string;
      secret?: string | null;
      events?: string;
      active?: boolean;
    },
    ip: string,
  ) {
    const existing = await this.ensureEndpoint(id);
    const updated = await this.prisma.webhookEndpoint.update({
      where: { id },
      data: {
        ...(data.label !== undefined
          ? { label: data.label?.trim() || null }
          : {}),
        ...(data.url !== undefined ? { url: data.url.trim() } : {}),
        ...(data.secret !== undefined
          ? { secret: data.secret?.trim() || null }
          : {}),
        ...(data.events !== undefined
          ? { events: data.events.trim() || '*' }
          : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'webhook_endpoint.update',
        resource: 'WebhookEndpoint',
        resourceId: id,
        metadata: {
          role: user.role,
          from: Object.fromEntries(
            Object.keys(data).map((key) => [
              key,
              key === 'secret' ? '***' : existing[key as keyof typeof existing],
            ]),
          ),
          to: Object.fromEntries(
            Object.keys(data).map((key) => [
              key,
              key === 'secret' ? '***' : updated[key as keyof typeof updated],
            ]),
          ),
        },
        ip,
      }),
      'audit webhook endpoint update',
    );

    fireAndForget(
      this.redisService.clearCacheByPrefix('webhooks:endpoints:list:'),
      'clear webhooks list cache',
    );

    return updated;
  }

  async deleteEndpoint(user: JwtUser, id: string, ip: string) {
    const existing = await this.ensureEndpoint(id);
    await this.prisma.webhookEndpoint.delete({ where: { id } });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'webhook_endpoint.delete',
        resource: 'WebhookEndpoint',
        resourceId: id,
        metadata: {
          role: user.role,
          label: existing.label,
          url: existing.url,
        },
        ip,
      }),
      'audit webhook endpoint deletion',
    );

    fireAndForget(
      this.redisService.clearCacheByPrefix('webhooks:endpoints:list:'),
      'clear webhooks list cache',
    );

    return { ok: true };
  }

  async listDeliveries(endpointId: string, query: WebhookDeliveryQueryDto) {
    const {
      page = 1,
      limit = 50,
      event,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: any = { endpointId };
    if (event) {
      where.event = { contains: event, mode: 'insensitive' };
    }
    if (status) {
      where.status = status;
    }

    const [items, total] = await Promise.all([
      this.prisma.webhookDelivery.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.webhookDelivery.count({ where }),
    ]);

    return {
      data: items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  private async ensureEndpoint(id: string) {
    const row = await this.prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Webhook endpoint not found');
    return row;
  }

  /** Fire-and-forget outbound notifications for active endpoints subscribed to `event`. */
  async queueEvent(event: string, payload: Record<string, unknown>) {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { active: true },
    });
    const body = JSON.stringify(payload);
    for (const ep of endpoints) {
      if (!this.matchesEvents(ep.events, event)) continue;
      const delivery = await this.prisma.webhookDelivery.create({
        data: {
          endpointId: ep.id,
          event,
          payload: payload as object,
          status: WebhookDeliveryStatus.PENDING,
        },
      });
      void this.tryDispatch(delivery.id, ep.url, ep.secret, event, body);
    }
  }

  private async tryDispatch(
    deliveryId: string,
    url: string,
    secret: string | null,
    event: string,
    body: string,
  ) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-UnBoxIO-Event': event,
    };
    if (secret) {
      const sig = createHmac('sha256', secret).update(body).digest('hex');
      headers['X-UnBoxIO-Signature'] = `sha256=${sig}`;
    }
    try {
      const res = await fetch(url, { method: 'POST', headers, body });
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: res.ok
            ? WebhookDeliveryStatus.SENT
            : WebhookDeliveryStatus.FAILED,
          attempts: { increment: 1 },
          responseCode: res.status,
          lastError: res.ok ? null : `HTTP ${res.status}`,
          completedAt: new Date(),
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: WebhookDeliveryStatus.FAILED,
          attempts: { increment: 1 },
          lastError: msg.slice(0, 2000),
          completedAt: new Date(),
        },
      });
    }
  }

  async pingTest(user: JwtUser, endpointId: string, ip: string) {
    const ep = await this.ensureEndpoint(endpointId);
    const payload = {
      ok: true,
      at: new Date().toISOString(),
      endpointId: ep.id,
    };
    const body = JSON.stringify(payload);
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        endpointId: ep.id,
        event: 'webhook.test',
        payload: payload as object,
        status: WebhookDeliveryStatus.PENDING,
      },
    });

    fireAndForget(
      this.audit.log({
        userId: user.sub,
        action: 'webhook_endpoint.test',
        resource: 'WebhookEndpoint',
        resourceId: ep.id,
        metadata: {
          role: user.role,
          deliveryId: delivery.id,
        },
        ip,
      }),
      'audit webhook endpoint test ping',
    );

    void this.tryDispatch(delivery.id, ep.url, ep.secret, 'webhook.test', body);
    return { queued: true, deliveryId: delivery.id };
  }
}
