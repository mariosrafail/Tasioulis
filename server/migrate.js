import './config.js';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
if (!process.env.DATABASE_URL_UNPOOLED) throw new Error('DATABASE_URL_UNPOOLED is required for migrations.');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
try {
  await db.connect();
  await db.query('BEGIN');
  await db.query(await readFile(new URL('../migrations/001-reservations.sql', import.meta.url), 'utf8'));
  await db.query('COMMIT');
  console.log('Reservation schema is ready.');
} catch (error) {
  await db.query('ROLLBACK').catch(() => {});
  console.error('Migration failed:', error.code || error.name); process.exitCode = 1;
} finally { await db.end(); }
