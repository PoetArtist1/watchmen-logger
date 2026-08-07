const express = require('express');
const { createLogger } = require('../src');

const PORT = Number(process.env.PORT) || 3847;

async function main() {
  // Prefer memory for a clean demo each run unless LOGGER_CONFIG_PATH is set
  const logger = await createLogger({
    configPath: process.env.LOGGER_CONFIG_PATH || undefined,
    overrides: process.env.LOGGER_CONFIG_PATH
      ? undefined
      : {
          storage: {
            strategy: 'memory',
            config: { max_records: 2000, cleanup_enabled: false }
          },
          capture: {
            excluded_paths: ['/health', '/favicon.ico'],
            response_body: true
          },
          monitoring: {
            enabled: true,
            endpoint: '/api/monitoring',
            auto_refresh_interval: 5,
            cache_metrics: false,
            auth: { enabled: false }
          }
        }
  });

  const app = express();
  app.use(express.json());
  logger.attach(app);

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.get('/api/users', async (req, res) => {
    await logger.logInfo('Listing users', { requestId: req.requestId });
    res.json([
      { id: 1, name: 'Ada' },
      { id: 2, name: 'Grace' }
    ]);
  });

  app.post('/api/users', (req, res) => {
    res.status(201).json({ id: 3, ...req.body });
  });

  app.get('/api/orders/:id', (req, res) => {
    if (req.params.id === '404') {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (req.params.id === '500') {
      return res.status(500).json({ error: 'Payment provider timeout' });
    }
    return res.json({ id: req.params.id, total: 42.5 });
  });

  app.get('/api/slow', async (_req, res) => {
    await new Promise((r) => setTimeout(r, 180));
    res.json({ ok: true, delayed_ms: 180 });
  });

  app.listen(PORT, async () => {
    console.log(`\n  watchmen demo`);
    console.log(`  UI  → http://localhost:${PORT}/api/monitoring/`);
    console.log(`  (abre esa URL — no /requests directo; eso es JSON de la API)\n`);
    // Seed a bit of traffic so the dashboard is not empty
    const base = `http://127.0.0.1:${PORT}`;
    const paths = [
      '/api/users',
      '/api/users',
      '/api/orders/10',
      '/api/orders/404',
      '/api/orders/500',
      '/api/slow'
    ];
    for (const p of paths) {
      try {
        await fetch(`${base}${p}`);
      } catch {
        /* ignore seed errors */
      }
    }
    try {
      await fetch(`${base}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Lin' })
      });
    } catch {
      /* ignore */
    }
    console.log('  Sample traffic seeded. Open the UI and explore.\n');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
