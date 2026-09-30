import { db } from './db.js';
import { clientIp } from './ratelimit.js';

const insert = db.prepare('INSERT INTO audit_log (user_id, actor, action, detail, ip) VALUES (?, ?, ?, ?, ?)');

/** Deja constancia de lo que pasa en la tienda: quién, qué y desde dónde */
export function audit(action, { req = null, user = null, detail = '' } = {}) {
  const actor = user?.email || req?.user?.email || 'anónimo';
  const userId = user?.id ?? req?.user?.id ?? null;
  try {
    insert.run(userId, actor, action, String(detail).slice(0, 400), req ? clientIp(req) : '');
  } catch (err) {
    console.error('No se ha podido escribir en el registro de actividad:', err.message);
  }
}

export function recentAudit(limit = 80) {
  return db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?').all(Math.min(300, Number(limit) || 80));
}
