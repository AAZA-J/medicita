import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, types } from 'pg';

// Las columnas DATE se devuelven como texto 'AAAA-MM-DD' para no tener
// problemas con la zona horaria.
types.setTypeParser(1082, (v) => v);

@Injectable()
export class DbService implements OnModuleDestroy {
  private pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'medicita',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    // Misma zona horaria que el centro médico para comparar fechas con NOW()
    options: `-c timezone=${process.env.TZ || 'America/Guayaquil'}`,
  });

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const r = await this.pool.query(sql, params);
    return r.rows;
  }

  async one<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    const rows = await this.query<T>(sql, params);
    return rows[0];
  }

  // Ejecuta varias consultas como una sola transacción
  async tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const r = await fn(c);
      await c.query('COMMIT');
      return r;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }

  onModuleDestroy() {
    return this.pool.end();
  }
}
