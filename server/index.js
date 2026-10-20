import { pool } from './db.js';
import { createApp } from './app.js';
import { fileURLToPath } from 'node:url';
const port = Number(process.env.PORT || 18764);
const server = createApp(pool,{staticRoot:fileURLToPath(new URL('../',import.meta.url))}).listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Elements ready: http://127.0.0.1:${port}`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close(() => pool.end().finally(() => process.exit())));
