import { Pool, QueryResultRow } from 'pg';
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile();
  } catch {}
}
const globalForDb=globalThis as unknown as {pool?:Pool};
export const pool=globalForDb.pool??new Pool({
  connectionString:process.env.DATABASE_URL,
  max:Number(process.env.DB_POOL_MAX||10),
  idleTimeoutMillis:30000,
  connectionTimeoutMillis:5000,
  keepAlive:true,
  ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined
});
globalForDb.pool=pool;
export async function query<T extends QueryResultRow>(text:string,params:unknown[]=[]):Promise<T[]>{const result=await pool.query<T>(text,params);return result.rows}
