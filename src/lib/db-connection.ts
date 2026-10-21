import { Client } from 'pg';
import { logger } from './logger';

let isDbOffline = false;
let lastDbCheck = 0;
const DB_RETRY_INTERVAL = 120 * 1000; // 2 minutes

export function isDatabaseOffline(): boolean {
  if (isDbOffline && Date.now() - lastDbCheck < DB_RETRY_INTERVAL) {
    return true;
  }
  return false;
}

export function markDatabaseOffline(err?: any): void {
  const isFirstTrip = !isDbOffline || Date.now() - lastDbCheck >= DB_RETRY_INTERVAL;
  isDbOffline = true;
  lastDbCheck = Date.now();
  if (isFirstTrip && err) {
    logger.warn(`[DB Connection] Remote database unreachable (${err?.message || err}). Running on in-memory store.`);
  }
}

export function getSafePgClient(connectionTimeoutMillis = 5000): Client | null {
  if (isDatabaseOffline()) {
    return null;
  }
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) return null;
  return new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis,
  });
}
