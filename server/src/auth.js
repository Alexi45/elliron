import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { randomToken, sha256 } from './security.js';

const isProd = process.env.NODE_ENV === 'production';

if (!process.env.JWT_SECRET && isProd) {
  console.error('Falta JWT_SECRET en el entorno. No arranco en producción sin él.');
  process.exit(1);
}
const SECRET = process.env.JWT_SECRET || 'liron-desarrollo-no-usar-en-produccion';

export const ACCESS_TTL = '15m';
export const REFRESH_DAYS = 30;
// El prefijo __Secure- obliga al navegador a mandarla solo por HTTPS
export const REFRESH_COOKIE = isProd ? '__Secure-liron_rt' : 'liron_rt';
const COOKIE_PATH = '/api/auth';

/* ------------------------------------------------------------------
   Token de acceso: corto, firmado, viaja en la cabecera Authorization
   ------------------------------------------------------------------ */

export function signAccess(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, name: user.name, email: user.email },
    SECRET,
    { expiresIn: ACCESS_TTL, issuer: 'el-liron' }
  );
}

export function verifyAccess(token) {
  try {
    return jwt.verify(token, SECRET, { issuer: 'el-liron' });
  } catch {
    return null;
  }
}

/* Vale corto que solo sirve para terminar de entrar con el código de dos pasos */
export function signChallenge(userId) {
  return jwt.sign({ sub: String(userId), purpose: '2fa' }, SECRET, { expiresIn: '5m', issuer: 'el-liron' });
}

export function verifyChallenge(token) {
  try {
    const claims = jwt.verify(token, SECRET, { issuer: 'el-liron' });
    return claims.purpose === '2fa' ? Number(claims.sub) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------
   Refresh token: opaco y rotatorio. Se guarda solo su hash y se detecta
   la reutilización (si alguien roba uno ya usado, cae toda la familia).
   ------------------------------------------------------------------ */

function expiryISO(days = REFRESH_DAYS) {
  return new Date(Date.now() + days * 86400_000).toISOString();
}

export function createSession(userId, req, family = randomToken(12)) {
  const raw = randomToken(32);
  db.prepare(
    `INSERT INTO sessions (user_id, token_hash, family, user_agent, ip, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    sha256(raw),
    family,
    String(req.headers['user-agent'] || '').slice(0, 200),
    String(req.ip || '').slice(0, 60),
    expiryISO()
  );
  return { raw, family };
}

/**
 * Canjea un refresh token por otro nuevo.
 * Devuelve { user, raw } o { error } si no vale.
 */
export function rotateSession(rawToken, req) {
  if (!rawToken) return { error: 'sin-token' };
  const row = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(sha256(rawToken));
  if (!row) return { error: 'desconocido' };

  if (row.revoked_at) {
    // Token ya usado: alguien lo está reutilizando. Tiramos la familia entera.
    db.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE family = ? AND revoked_at IS NULL").run(row.family);
    return { error: 'reutilizado', userId: row.user_id };
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE id = ?").run(row.id);
    return { error: 'caducado' };
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
  if (!user || user.status !== 'activo') return { error: 'cuenta-no-disponible' };

  db.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE id = ?").run(row.id);
  const { raw } = createSession(user.id, req, row.family);
  return { user, raw };
}

export function revokeSession(rawToken) {
  if (!rawToken) return;
  db.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE token_hash = ? AND revoked_at IS NULL").run(
    sha256(rawToken)
  );
}

export function revokeAllForUser(userId) {
  db.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL").run(userId);
}

export function activeSessions(userId) {
  return db
    .prepare(
      `SELECT id, user_agent, ip, created_at, expires_at FROM sessions
       WHERE user_id = ? AND revoked_at IS NULL AND expires_at > datetime('now')
       ORDER BY created_at DESC`
    )
    .all(userId);
}

/* Limpieza periódica de sesiones muertas */
export function purgeSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now', '-7 days')").run();
}

/* ------------------------------------------------------------------
   Cookies
   ------------------------------------------------------------------ */

export function setRefreshCookie(res, raw) {
  res.cookie(REFRESH_COOKIE, raw, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProd,
    path: COOKIE_PATH,
    maxAge: REFRESH_DAYS * 86400_000
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, sameSite: 'strict', secure: isProd, path: COOKIE_PATH });
}

/* ------------------------------------------------------------------
   Middlewares
   ------------------------------------------------------------------ */

function claimsFrom(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return verifyAccess(header.slice(7));
}

export function optionalAuth(req, _res, next) {
  const claims = claimsFrom(req);
  if (claims) {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(claims.sub));
    if (user && user.status === 'activo') req.user = user;
  }
  next();
}

export function requireAuth(req, res, next) {
  const claims = claimsFrom(req);
  if (!claims) return res.status(401).json({ error: 'Necesitas iniciar sesión.', code: 'sin-sesion' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(claims.sub));
  if (!user) return res.status(401).json({ error: 'Necesitas iniciar sesión.', code: 'sin-sesion' });
  if (user.status !== 'activo') return res.status(403).json({ error: 'Esta cuenta está bloqueada.' });

  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    requireAuth(req, res, (err) => {
      if (err) return next(err);
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'No tienes permiso para esto.' });
      }
      next();
    });
  };
}

/**
 * ¿Puede esta persona reservar o apuntarse? Un veto puede tener fecha de fin:
 * cuando pasa, se levanta solo.
 */
export function checkStanding(user) {
  if (!user || user.standing !== 'vetado') return { blocked: false };

  if (user.standing_until && new Date(`${user.standing_until}T23:59:59`).getTime() < Date.now()) {
    db.prepare("UPDATE users SET standing = 'aviso', standing_until = NULL WHERE id = ?").run(user.id);
    return { blocked: false };
  }

  const hasta = user.standing_until ? ` hasta el ${user.standing_until}` : '';
  return {
    blocked: true,
    message: `Tu cuenta no puede reservar ni apuntarse a eventos${hasta}. Habla con nosotros en la tienda y lo arreglamos.`
  };
}

/** Lo único del usuario que sale del servidor */
export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone || '',
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at,
    standing: user.standing || 'ok',
    standingNote: user.standing_note || '',
    standingUntil: user.standing_until || null,
    twoFactor: Boolean(user.totp_enabled)
  };
}
