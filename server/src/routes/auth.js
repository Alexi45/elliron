import express from 'express';
import { allSettings, db } from '../db.js';
import { audit } from '../audit.js';
import { clientIp, rateLimit, reset } from '../ratelimit.js';
import {
  ACCESS_TTL,
  activeSessions,
  signChallenge,
  verifyChallenge,
  clearRefreshCookie,
  createSession,
  publicUser,
  REFRESH_COOKIE,
  requireAuth,
  revokeAllForUser,
  revokeSession,
  rotateSession,
  setRefreshCookie,
  signAccess
} from '../auth.js';
import {
  checkPasswordPolicy,
  clean,
  hashPassword,
  isValidEmail,
  normalizeEmail,
  verifyPassword
} from '../security.js';
import { pwnedMessage } from '../pwned.js';
import {
  backupCodesLeft,
  buildEnrolment,
  generateBackupCodes,
  generateSecret,
  useBackupCode,
  verifyCode
} from '../totp.js';

export const authRouter = express.Router();

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

/* Hash de descarte: si el correo no existe comparamos igualmente para que
   acertar o fallar el usuario tarde lo mismo (no se puede sondear quién
   tiene cuenta midiendo tiempos). */
const DUMMY_HASH = hashPassword('el-liron-usuario-inexistente');

const byEmail = db.prepare('SELECT * FROM users WHERE email = ?');

function startSession(res, req, user) {
  const { raw } = createSession(user.id, req);
  setRefreshCookie(res, raw);
  return signAccess(user);
}

function userPayload(user) {
  const pending = db
    .prepare("SELECT COUNT(*) AS n FROM reservations WHERE user_id = ? AND status = 'pendiente'")
    .get(user.id).n;
  const signups = db.prepare('SELECT COUNT(*) AS n FROM event_signups WHERE user_id = ?').get(user.id).n;
  const strikes = db
    .prepare("SELECT COUNT(*) AS n FROM incidents WHERE user_id = ? AND forgiven = 0 AND severity != 'aviso'")
    .get(user.id).n;
  return { ...publicUser(user), pendingReservations: pending, signups, strikes };
}

/* ------------------------------------------------------------------ registro */

authRouter.post(
  '/register',
  rateLimit({ name: 'register', windowMs: 60 * 60_000, max: 5 }),
  async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const name = clean(req.body?.name, 80);
    const phone = clean(req.body?.phone, 30);
    const password = String(req.body?.password || '');

    if (allSettings().registration_open === false) {
      return res.status(403).json({
        error: 'Ahora mismo no se pueden crear cuentas nuevas. Escríbenos por Instagram y te ayudamos.'
      });
    }

    if (!name || name.length < 2) return res.status(400).json({ error: 'Dinos cómo te llamas.' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Ese correo no parece válido.' });

    const policy = checkPasswordPolicy(password, { email, name });
    if (!policy.ok) return res.status(400).json({ error: policy.error });

    const filtrada = await pwnedMessage(password);
    if (filtrada) return res.status(400).json({ error: filtrada });

    if (byEmail.get(email)) {
      return res.status(409).json({ error: 'Ya hay una cuenta con ese correo. Prueba a iniciar sesión.' });
    }

    const info = db
      .prepare('INSERT INTO users (email, name, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)')
      .run(email, name, hashPassword(password), 'user', phone);

    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(Number(info.lastInsertRowid));
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(info.lastInsertRowid));
    const accessToken = startSession(res, req, user);
    audit('registro', { req, user, detail: email });

    res.status(201).json({ accessToken, expiresIn: ACCESS_TTL, user: userPayload(user) });
  }
);

/* ------------------------------------------------------------------ acceso */

authRouter.post(
  '/login',
  rateLimit({ name: 'login-ip', windowMs: 15 * 60_000, max: 20 }),
  rateLimit({ name: 'login-cuenta', windowMs: 15 * 60_000, max: 8, keyFrom: (req) => normalizeEmail(req.body?.email) }),
  (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const user = byEmail.get(email);

    // Siempre el mismo mensaje: nadie puede averiguar qué correos están registrados
    const genericError = () => res.status(401).json({ error: 'Correo o contraseña incorrectos.' });

    if (!user) {
      verifyPassword(password, DUMMY_HASH);
      audit('login-fallido', { req, detail: `correo desconocido: ${email}` });
      return genericError();
    }

    if (user.status !== 'activo') {
      audit('login-bloqueado', { req, user, detail: 'cuenta suspendida' });
      return res.status(403).json({ error: 'Esta cuenta está bloqueada. Habla con la tienda.' });
    }

    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      const mins = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      return res.status(429).json({ error: `Demasiados intentos. Prueba de nuevo en ${mins} min.` });
    }

    if (!verifyPassword(password, user.password_hash)) {
      const failed = user.failed_attempts + 1;
      const lockedUntil =
        failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null;
      db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?').run(
        lockedUntil ? 0 : failed,
        lockedUntil,
        user.id
      );
      audit('login-fallido', { req, user, detail: `intento ${failed}` });
      if (lockedUntil) {
        return res.status(429).json({ error: `Demasiados intentos. Cuenta bloqueada ${LOCK_MINUTES} min.` });
      }
      return genericError();
    }

    db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
    reset(`login-cuenta:${clientIp(req)}:${email}`);

    // Con verificación en dos pasos, la contraseña sola no abre la sesión
    if (user.totp_enabled) {
      audit('login-paso1', { req, user });
      return res.json({ needsTwoFactor: true, challenge: signChallenge(user.id) });
    }

    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
    const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    const accessToken = startSession(res, req, fresh);
    audit('login', { req, user: fresh });

    res.json({ accessToken, expiresIn: ACCESS_TTL, user: userPayload(fresh) });
  }
);

/* --------------------------------------------------- segundo paso (2FA) */

authRouter.post(
  '/login/2fa',
  rateLimit({ name: '2fa', windowMs: 15 * 60_000, max: 12 }),
  (req, res) => {
    const userId = verifyChallenge(req.body?.challenge);
    if (!userId) return res.status(401).json({ error: 'El intento ha caducado. Vuelve a entrar.' });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user || user.status !== 'activo') return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });

    const code = String(req.body?.code || '').trim();
    let ok = verifyCode(user.totp_secret, code);

    if (!ok) {
      // ¿Será uno de los códigos de respaldo?
      const rest = useBackupCode(user.totp_backup, code);
      if (rest !== null) {
        db.prepare('UPDATE users SET totp_backup = ? WHERE id = ?').run(rest, user.id);
        audit('2fa-respaldo', { req, user, detail: `quedan ${backupCodesLeft(rest)}` });
        ok = true;
      }
    }

    if (!ok) {
      audit('2fa-fallido', { req, user });
      return res.status(401).json({ error: 'Ese código no es válido.' });
    }

    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
    const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    const accessToken = startSession(res, req, fresh);
    audit('login', { req, user: fresh, detail: 'con verificación en dos pasos' });

    res.json({ accessToken, expiresIn: ACCESS_TTL, user: userPayload(fresh) });
  }
);

/* ------------------------------------------------------------------ refresco */

authRouter.post('/refresh', rateLimit({ name: 'refresh', windowMs: 60_000, max: 60 }), (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  const result = rotateSession(raw, req);

  if (result.error) {
    clearRefreshCookie(res);
    if (result.error === 'reutilizado') {
      audit('sesion-reutilizada', { req, detail: `usuario ${result.userId}: se han cerrado todas sus sesiones` });
    }
    return res.status(401).json({ error: 'Tu sesión ha caducado.', code: 'sin-sesion' });
  }

  setRefreshCookie(res, result.raw);
  res.json({ accessToken: signAccess(result.user), expiresIn: ACCESS_TTL, user: userPayload(result.user) });
});

/* ------------------------------------------------------------------ salida */

authRouter.post('/logout', (req, res) => {
  revokeSession(req.cookies?.[REFRESH_COOKIE]);
  clearRefreshCookie(res);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ cuenta */

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: userPayload(req.user) });
});

authRouter.patch('/me', requireAuth, (req, res) => {
  const name = clean(req.body?.name, 80) || req.user.name;
  const phone = clean(req.body?.phone, 30);
  db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(name, phone, req.user.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  audit('perfil-actualizado', { req, user });
  res.json({ user: userPayload(user) });
});

authRouter.post(
  '/change-password',
  requireAuth,
  rateLimit({ name: 'cambio-pw', windowMs: 60 * 60_000, max: 10 }),
  async (req, res) => {
    const current = String(req.body?.currentPassword || '');
    const next = String(req.body?.newPassword || '');

    if (!verifyPassword(current, req.user.password_hash)) {
      audit('cambio-pw-fallido', { req, user: req.user });
      return res.status(401).json({ error: 'La contraseña actual no es correcta.' });
    }
    const policy = checkPasswordPolicy(next, { email: req.user.email, name: req.user.name });
    if (!policy.ok) return res.status(400).json({ error: policy.error });
    if (verifyPassword(next, req.user.password_hash)) {
      return res.status(400).json({ error: 'Esa es la contraseña que ya tenías.' });
    }
    const filtrada = await pwnedMessage(next);
    if (filtrada) return res.status(400).json({ error: filtrada });

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), req.user.id);
    revokeAllForUser(req.user.id); // fuera todas las sesiones, incluida esta
    const accessToken = startSession(res, req, req.user);
    audit('cambio-pw', { req, user: req.user, detail: 'sesiones anteriores cerradas' });

    res.json({ ok: true, accessToken, expiresIn: ACCESS_TTL });
  }
);

authRouter.get('/sessions', requireAuth, (req, res) => {
  res.json({ sessions: activeSessions(req.user.id) });
});

authRouter.post('/sessions/close-others', requireAuth, (req, res) => {
  revokeAllForUser(req.user.id);
  const accessToken = startSession(res, req, req.user);
  audit('sesiones-cerradas', { req, user: req.user });
  res.json({ ok: true, accessToken });
});

/* ------------------------------------------------- verificación en dos pasos */

authRouter.get('/2fa', requireAuth, (req, res) => {
  res.json({
    enabled: Boolean(req.user.totp_enabled),
    backupCodesLeft: backupCodesLeft(req.user.totp_backup)
  });
});

/** Paso 1: genera el secreto y devuelve el QR para la app del móvil */
authRouter.post('/2fa/setup', requireAuth, rateLimit({ name: '2fa-setup', windowMs: 60 * 60_000, max: 10 }), async (req, res) => {
  if (req.user.totp_enabled) return res.status(400).json({ error: 'Ya la tienes activada.' });

  const secret = generateSecret();
  db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?').run(secret, req.user.id);
  const { uri, qr } = await buildEnrolment(secret, req.user.email);
  res.json({ secret, uri, qr });
});

/** Paso 2: confirma con un código y entrega los códigos de respaldo */
authRouter.post('/2fa/enable', requireAuth, rateLimit({ name: '2fa-enable', windowMs: 15 * 60_000, max: 12 }), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user.totp_secret) return res.status(400).json({ error: 'Empieza por generar el código QR.' });
  if (!verifyCode(user.totp_secret, req.body?.code)) return res.status(400).json({ error: 'Ese código no es válido.' });

  const { codes, stored } = generateBackupCodes();
  db.prepare('UPDATE users SET totp_enabled = 1, totp_backup = ? WHERE id = ?').run(stored, user.id);
  audit('2fa-activado', { req, user });
  res.json({ ok: true, backupCodes: codes });
});

authRouter.post('/2fa/disable', requireAuth, rateLimit({ name: '2fa-off', windowMs: 60 * 60_000, max: 8 }), (req, res) => {
  if (!verifyPassword(String(req.body?.password || ''), req.user.password_hash)) {
    return res.status(401).json({ error: 'La contraseña no es correcta.' });
  }
  if (!verifyCode(req.user.totp_secret, req.body?.code)) {
    return res.status(400).json({ error: 'Necesitamos un código válido de la app.' });
  }
  db.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_backup = NULL WHERE id = ?').run(req.user.id);
  audit('2fa-desactivado', { req, user: req.user });
  res.json({ ok: true });
});

authRouter.post('/2fa/backup-codes', requireAuth, (req, res) => {
  if (!req.user.totp_enabled) return res.status(400).json({ error: 'No tienes la verificación activada.' });
  if (!verifyCode(req.user.totp_secret, req.body?.code)) return res.status(400).json({ error: 'Ese código no es válido.' });
  const { codes, stored } = generateBackupCodes();
  db.prepare('UPDATE users SET totp_backup = ? WHERE id = ?').run(stored, req.user.id);
  audit('2fa-respaldo-nuevo', { req, user: req.user });
  res.json({ backupCodes: codes });
});
