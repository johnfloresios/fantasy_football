import express from 'express';
import path from 'node:path';

export async function createApp(pool, dist = path.resolve('dist')) {
  await pool.query(`CREATE TABLE IF NOT EXISTS workspace (
    id integer PRIMARY KEY CHECK (id = 1),
    state jsonb NOT NULL,
    revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    // This app is intended for a trusted LAN; reject cross-origin browser writes.
    if (req.method !== 'GET' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
      return res.status(403).json({error: 'Cross-origin writes are not allowed.'});
    }
    next();
  });
  app.use(express.json({limit: '10mb'}));
  app.get('/api/health', async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ok: true});
  });
  app.get('/api/state', async (req, res) => {
    const {rows} = await pool.query('SELECT state, revision FROM workspace WHERE id = 1');
    res.json(rows[0] || {state: null, revision: 0});
  });
  app.put('/api/state', async (req, res) => {
    const {state, revision} = req.body || {};
    if (!Number.isInteger(revision) || revision < 0 || !state || !Array.isArray(state.players) ||
        !Array.isArray(state.picks) || !state.settings || !Number.isInteger(state.settings.teams) ||
        state.settings.teams < 2 || state.settings.teams > 20 || !Number.isInteger(state.settings.rounds) ||
        state.settings.rounds < 9 || state.settings.rounds > 25 || !Number.isInteger(state.settings.slot) ||
        state.settings.slot < 1 || state.settings.slot > state.settings.teams ||
        (state.watched !== undefined && !Array.isArray(state.watched))) {
      return res.status(400).json({error: 'Invalid draft state.'});
    }
    const result = revision === 0
      ? await pool.query('INSERT INTO workspace (id, state) VALUES (1, $1) ON CONFLICT DO NOTHING RETURNING revision', [state])
      : await pool.query('UPDATE workspace SET state = $1, revision = revision + 1, updated_at = now() WHERE id = 1 AND revision = $2 RETURNING revision', [state, revision]);
    if (!result.rowCount) return res.status(409).json({error: 'The draft changed in another browser. Reload before making more changes.'});
    res.json({revision: result.rows[0].revision});
  });
  app.use('/api', (req, res) => res.status(404).json({error: 'Unknown API route.'}));
  app.use(express.static(dist));
  app.get('/', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  app.use((err, req, res, next) => {
    console.error(err.message);
    res.status(err.status || 503).json({error: err.status === 413 ? 'Draft is too large (maximum 10 MB).' : 'Unable to save or load the draft. Please try again.'});
  });
  return app;
}
