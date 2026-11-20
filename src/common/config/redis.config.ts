import { registerAs } from '@nestjs/config';

const host = process.env.REDIS_URI;
const port = Number(process.env.REDIS_PORT);
const password = process.env.REDIS_PASSWORD ?? '';
const username = process.env.REDIS_USER ?? 'default';
const db = Number(process.env.REDIS_DB ?? 0);

if (!host || !port) {
  throw new Error(
    'Missing Redis configuration: REDIS_URI and REDIS_PORT are required',
  );
}

// ElastiCache Valkey in AWS (Redis-compatible wire protocol).
export default registerAs('redis', () => ({
  engine: process.env.CACHE_ENGINE ?? 'valkey',
  connection: {
    host,
    port,
    password: password || undefined,
    username: username || undefined,
    db,
  },
}));
