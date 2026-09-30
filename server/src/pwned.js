import { createHash } from 'node:crypto';

/* ------------------------------------------------------------------
   Comprueba si una contraseña aparece en filtraciones conocidas usando
   el servicio de Have I Been Pwned con k-anonimato: solo salen de aquí
   los cinco primeros caracteres del SHA-1, nunca la contraseña ni su
   hash completo. Si no hay red, se deja pasar (nunca bloquea el alta).
   ------------------------------------------------------------------ */

const CACHE = new Map();
const CACHE_TTL = 60 * 60_000;

export async function timesPwned(password, { timeoutMs = 2500 } = {}) {
  if (process.env.CHECK_PWNED === 'false') return 0;

  const hash = createHash('sha1').update(String(password), 'utf8').digest('hex').toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  const cached = CACHE.get(prefix);
  const body = cached && cached.at > Date.now() - CACHE_TTL ? cached.body : await fetchRange(prefix, timeoutMs);
  if (body === null) return 0; // sin red: no bloqueamos a nadie por esto
  CACHE.set(prefix, { body, at: Date.now() });

  for (const line of body.split('\n')) {
    const [tail, count] = line.trim().split(':');
    if (tail === suffix) return Number(count) || 1;
  }
  return 0;
}

async function fetchRange(prefix, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: controller.signal,
      headers: { 'Add-Padding': 'true', 'User-Agent': 'el-liron-web' }
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Mensaje para el usuario, o null si la contraseña no está en ninguna lista */
export async function pwnedMessage(password) {
  const times = await timesPwned(password);
  if (times === 0) return null;
  return times > 1000
    ? 'Esa contraseña aparece en filtraciones conocidas y se prueba muchísimo. Elige otra.'
    : 'Esa contraseña aparece en filtraciones de otras webs. Por seguridad, elige otra.';
}
