import pg from 'pg';
import {createApp} from './app.js';
const pool = new pg.Pool({connectionTimeoutMillis: 5000, query_timeout: 10000});
pool.on('error', err => console.error('Database connection:', err.message));
const app = await createApp(pool);
const server = app.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('Draftroom listening on port ' + (process.env.PORT || 3000)));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(async () => {await pool.end(); process.exit(0);}));
