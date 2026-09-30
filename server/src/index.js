import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { db } from './db.js';
import { buildState } from './state.js';
import { addClient, broadcast } from './bus.js';
import { purgeSessions } from './auth.js';
import { rateLimit } from './ratelimit.js';
import { hashPassword, isValidEmail, normalizeEmail } from './security.js';
import { authRouter } from './routes/auth.js';
import { customerRouter } from './routes/customer.js';
import { adminRouter } from './routes/admin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 4000);
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1); // detrás de un proxy, para que req.ip sea la real
app.disable('x-powered-by');

/* ------------------------------------------------------------------ */
/* Seguridad básica de la capa HTTP                                    */
/* ------------------------------------------------------------------ */

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https://*.googleapis.com https://*.gstatic.com https://*.google.com",
      "frame-src https://www.google.com https://maps.google.com",
      "connect-src 'self'"
    ].join('; ')
  );
  if (isProd) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
});

app.use(compression());

const origin = process.env.CORS_ORIGIN || true;
app.use(cors({ origin, credentials: true }));
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());

// Freno general para que nadie martillee la API
app.use('/api', rateLimit({ name: 'api', windowMs: 60_000, max: 400 }));

// Nada de la API se guarda en cachés intermedias
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

const push = () => broadcast('state', buildState());

/* ------------------------------------------------------------------ */
/* Primer administrador                                                */
/* ------------------------------------------------------------------ */

function bootstrapAdmin() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL || 'hola@elliron.es');
  const password = process.env.ADMIN_PASSWORD;
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const anyAdmin = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;

  if (existing) {
    if (existing.role !== 'admin') db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existing.id);
    return;
  }
  if (anyAdmin > 0) return;

  if (!password || password.length < 10) {
    console.warn(
      '\n  ⚠  No hay ningún administrador y ADMIN_PASSWORD no vale (mínimo 10 caracteres).\n' +
        '     Pon ADMIN_EMAIL y ADMIN_PASSWORD en server/.env y reinicia.\n'
    );
    return;
  }
  if (!isValidEmail(email)) {
    console.warn('  ⚠  ADMIN_EMAIL no es un correo válido, no creo el administrador.');
    return;
  }

  db.prepare('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)').run(
    email,
    process.env.ADMIN_NAME || 'Equipo El Lirón',
    hashPassword(password),
    'admin'
  );
  console.log(`  ✔  Administrador creado: ${email}`);
  if (isProd) console.log('     Cambia la contraseña desde el panel en cuanto entres.');
}

bootstrapAdmin();
purgeSessions();
setInterval(purgeSessions, 6 * 3600_000).unref();

/* ------------------------------------------------------------------ */
/* Público                                                             */
/* ------------------------------------------------------------------ */

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/state', (_req, res) => res.json(buildState()));

app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(`event: state\ndata: ${JSON.stringify(buildState())}\n\n`);
  const remove = addClient(res);
  // Latido con nombre: el navegador lo ve y sabe que el canal sigue vivo
  const ping = setInterval(() => {
    try {
      res.write('event: ping\ndata: {}\n\n');
    } catch {
      /* ignorado */
    }
  }, 20000);
  req.on('close', () => {
    clearInterval(ping);
    remove();
  });
});

app.use('/api/auth', authRouter);
app.use('/api', customerRouter(push));
app.use('/api/admin', adminRouter(push));

// Las fotos de los productos, con caché larga: el nombre lleva un hash
app.use(
  '/uploads',
  express.static(join(__dirname, '..', 'data', 'uploads'), { immutable: true, maxAge: '30d', fallthrough: true })
);

/* ------------------------------------------------------------------ */
/* Front compilado (producción)                                        */
/* ------------------------------------------------------------------ */

const dist = join(__dirname, '..', '..', 'web', 'dist');
if (existsSync(dist)) {
  // Los ficheros compilados llevan un hash en el nombre: se pueden cachear para siempre
  app.use(
    '/assets',
    express.static(join(dist, 'assets'), {
      immutable: true,
      maxAge: '365d'
    })
  );
  app.use(express.static(dist, { maxAge: '1h', index: false }));

  // Cualquier otra ruta la resuelve el front (menos /api)
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(join(dist, 'index.html'));
  });
} else if (isProd) {
  console.warn('  ⚠  No encuentro web/dist. Ejecuta `npm run build` antes de arrancar en producción.');
}

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ese recurso no existe.' }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Algo ha fallado en el servidor.' });
});

app.listen(PORT, () => {
  console.log(`🐭  API de El Lirón escuchando en http://localhost:${PORT}`);
});
