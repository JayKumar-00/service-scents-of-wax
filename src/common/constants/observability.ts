/** Routes that must not use the API response envelope (ALB, Prometheus, Swagger). */
export const PLAIN_HTTP_PATH_PREFIXES = [
  '/api/v1/health',
  '/api/v1/metrics',
  '/swagger',
  '/swagger-json',
] as const;

export function isPlainHttpPath(url: string): boolean {
  const path = url.split('?')[0];
  return PLAIN_HTTP_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
