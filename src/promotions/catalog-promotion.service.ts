import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Max percent discount per product id from active promotions (applyToAll + targeted). */
@Injectable()
export class CatalogPromotionService {
  constructor(private readonly prisma: PrismaService) {}

  private nowInWindow(
    startsAt: Date | null,
    endsAt: Date | null,
    now: Date,
  ): boolean {
    if (startsAt && now < startsAt) return false;
    if (endsAt && now > endsAt) return false;
    return true;
  }

  /**
   * Returns map productId -> best percentOff (0–100) among active promotions.
   */
  async bestPercentOffByProductId(
    productIds: string[],
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (!productIds.length) return out;
    const uniq = [...new Set(productIds)];
    const now = new Date();
    const promos = await this.prisma.promotion.findMany({
      where: { active: true },
      include: { promotionProducts: { select: { productId: true } } },
    });
    const active = promos.filter((p) =>
      this.nowInWindow(p.startsAt, p.endsAt, now),
    );
    const pct = (d: Prisma.Decimal) => Math.min(100, Math.max(0, Number(d)));

    for (const pid of uniq) {
      let best = 0;
      for (const pr of active) {
        const off = pct(pr.percentOff);
        if (off <= 0) continue;
        if (pr.applyToAll) {
          best = Math.max(best, off);
        } else {
          const hit = pr.promotionProducts.some((pp) => pp.productId === pid);
          if (hit) best = Math.max(best, off);
        }
      }
      if (best > 0) out.set(pid, best);
    }
    return out;
  }

  effectiveUnitPrice(
    basePrice: Prisma.Decimal,
    percentOff: number,
  ): Prisma.Decimal {
    if (!percentOff) return basePrice;
    const factor = new Prisma.Decimal(1).sub(
      new Prisma.Decimal(percentOff).div(100),
    );
    return basePrice.mul(factor).toDecimalPlaces(2);
  }
}
