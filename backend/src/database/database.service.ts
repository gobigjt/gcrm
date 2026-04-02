import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Pool, PoolClient, QueryResult } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  readonly pool: Pool;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url?.trim()) {
      throw new Error(
        'DATABASE_URL is not set. In production, reference your host’s Postgres URL (e.g. Railway: Variables → reference the Postgres plugin’s DATABASE_URL).',
      );
    }
    this.pool = new Pool({ connectionString: url });
  }

  async onModuleInit() {
    await this.pool.query('SELECT 1');
    this.logger.log('Database connected');
  }

  query(text: string, params?: any[]): Promise<QueryResult> {
    return this.pool.query(text, params);
  }

  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
