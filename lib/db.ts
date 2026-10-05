import { Pool, QueryResultRow } from 'pg';
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile();
  } catch {}
}
const globalForDb = globalThis as unknown as { pool?: Pool };

const isCloudPostgres = process.env.DATABASE_URL?.includes('neon.tech') || 
                        process.env.DATABASE_URL?.includes('supabase') || 
                        process.env.DATABASE_URL?.includes('sslmode=require');

export const pool = globalForDb.pool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  keepAlive: true,
  ssl: isCloudPostgres || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});
globalForDb.pool = pool;

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  try {
    const result = await pool.query<T>(text, params);
    return result.rows;
  } catch (err: any) {
    // If connection was dropped during a cold-start, retry once
    if (err?.message?.includes('Connection terminated') || err?.message?.includes('timeout')) {
      const retryResult = await pool.query<T>(text, params);
      return retryResult.rows;
    }
    throw err;
  }
}
