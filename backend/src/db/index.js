import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Unexpected database error', err);
});

export const db = {
  query: (text, params) => pool.query(text, params),

  getClient: async () => {
    const client = await pool.connect();
    const query = client.query.bind(client);
    const originalRelease = client.release.bind(client);

    // Timeout to ensure client release
    const timeout = setTimeout(() => {
      logger.warn('Client has been checked out for too long');
    }, 5000);

    client.release = () => {
      clearTimeout(timeout);
      originalRelease();
    };

    return client;
  },

  // Transaction helper
  transaction: async (callback) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Health check
  healthCheck: async () => {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  },

  // Graceful shutdown
  end: () => pool.end(),
};

export default db;
