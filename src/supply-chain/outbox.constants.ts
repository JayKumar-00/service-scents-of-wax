/** Max webhook dispatch attempts per outbox row before dead-lettering. */
export const DOMAIN_OUTBOX_MAX_ATTEMPTS = 10;

export function domainOutboxBackoffMs(attemptAfterIncrement: number): number {
  const n = Math.min(Math.max(attemptAfterIncrement, 1), 14);
  return Math.min(3_600_000, 1000 * Math.pow(2, n));
}
