const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimit');
const { sanitizeRequest } = require('./middleware/sanitize');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { UPLOAD_ROOT } = require('./services/storage.service');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    // Uploaded images are displayed by the client, which may live on another origin.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Applies when the API also serves the built React app.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        // blob: for image previews before upload, https: for object-storage URLs.
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  })
);

const allowedOrigins = env.CLIENT_URL.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);

app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());
app.use(sanitizeRequest);
if (!env.isTest) app.use(morgan(env.isProduction ? 'combined' : 'dev'));

app.get('/api/health', (_req, res) => res.json({ success: true, message: 'OK', data: { uptime: process.uptime() } }));
app.use('/api', apiLimiter, routes);

// Locally stored uploads. Names are random; nosniff prevents content-type confusion.
app.use(
  '/uploads',
  express.static(UPLOAD_ROOT, {
    fallthrough: false,
    index: false,
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  })
);

// In production the API can also serve the built React app.
if (env.isProduction) {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist, { index: false, maxAge: '7d' }));
  app.get(/^\/(?!api|uploads).*/, (_req, res, next) => res.sendFile(path.join(clientDist, 'index.html'), (err) => err && next()));
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
