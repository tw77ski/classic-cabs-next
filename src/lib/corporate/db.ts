// Corporate Portal Database Connection
// Uses the same DATABASE_URL as the main app

import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

/**
 * Get the database connection pool
 * Only initializes on the server side
 */
export function getPool(): Pool {
  if (typeof window !== 'undefined') {
    throw new Error('Database pool cannot be accessed on the client side');
  }

  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' 
        ? { rejectUnauthorized: false } 
        : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('[Corporate DB] Unexpected error on idle client:', err);
    });

    console.log('[Corporate DB] Pool initialized');
  }

  return pool;
}

/**
 * Execute a query with automatic connection handling
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number | null }> {
  const start = Date.now();
  
  try {
    const result = await getPool().query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[Corporate DB] Query:', {
        text: text.substring(0, 80),
        duration: `${duration}ms`,
        rows: result.rowCount,
      });
    }
    
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount,
    };
  } catch (error) {
    console.error('[Corporate DB] Query error:', error);
    throw error;
  }
}

/**
 * Get a client for transaction support
 */
export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

/**
 * Check if database is available
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    await getPool().query('SELECT 1');
    return true;
  } catch (error) {
    console.error('[Corporate DB] Database not available:', error);
    return false;
  }
}

/**
 * Check if corporate tables exist
 */
export async function areCorporateTablesReady(): Promise<boolean> {
  try {
    const result = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'corporate_users'
      ) as users_exist,
      EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'corporate_companies'
      ) as companies_exist
    `);
    
    const row = result.rows[0] as { users_exist: boolean; companies_exist: boolean };
    return row?.users_exist && row?.companies_exist;
  } catch {
    return false;
  }
}




