import './config.js';
import pg from 'pg';
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000 });
pool.on('error', () => console.error('Database connection interrupted.'));
