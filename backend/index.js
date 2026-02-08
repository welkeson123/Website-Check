const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { syncDatabase } = require('./models');
const monitorRoutes = require('./routes/monitorRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const authRoutes = require('./routes/authRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const storageRoutes = require('./routes/storageRoutes');
const publicRoutes = require('./routes/publicRoutes');
const { verifyToken } = require('./controllers/AuthController');
const schedulerService = require('./services/SchedulerService');
require('dotenv').config();
const { validateEnv } = require('./config/validateEnv');
const { logger } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  const requestId = String(req.headers['x-request-id'] || '').trim() || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  const start = Date.now();
  res.on('finish', () => {
    logger.info(
      {
        requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Date.now() - start,
      },
      'http_request'
    );
  });
  next();
});

// Static files
const storageDir = path.join(__dirname, 'storage');
app.use('/api/storage/screenshots', express.static(path.join(storageDir, 'screenshots')));
app.use('/api/storage/archives', express.static(path.join(storageDir, 'archives')));

// Routes
app.use('/', publicRoutes);
app.use('/api/auth', authRoutes);
// Protect API routes
app.use('/api/monitors', verifyToken, monitorRoutes);
app.use('/api/dashboard', verifyToken, dashboardRoutes);
app.use('/api/settings', verifyToken, settingsRoutes);
app.use('/api/storage', storageRoutes);

// Serve frontend (production build) if available
const distDir = path.join(__dirname, '..', 'frontend', 'dist');
const shouldServeDist =
  fs.existsSync(distDir) &&
  (process.env.NODE_ENV === 'production' ||
    String(process.env.SERVE_FRONTEND || '')
      .trim()
      .toLowerCase() === 'true');
if (shouldServeDist) {
  app.use(
    '/assets',
    express.static(path.join(distDir, 'assets'), {
      immutable: true,
      maxAge: '365d',
    })
  );
  app.use(
    express.static(distDir, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(`${path.sep}index.html`)) {
          res.setHeader('Cache-Control', 'no-store');
          return;
        }
        res.setHeader('Cache-Control', 'no-cache');
      },
    })
  );
  app.get('/assets/*', (req, res) => {
    res.status(404).end();
  });
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (
      /\.(?:js|css|map|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot)$/i.test(req.path)
    ) {
      res.status(404).end();
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Start server
const startServer = async () => {
  validateEnv();
  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'server_listening');
  });

  (async () => {
    const ok = await syncDatabase();
    if (!ok) return;
    try {
      await schedulerService.init();
    } catch (e) {
      logger.error({ err: e }, 'scheduler_init_failed');
    }
  })();
};

startServer();
