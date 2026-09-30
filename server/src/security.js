import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/* ------------------------------------------------------------------
   Contraseñas: scrypt (memory-hard) con sal propia por usuario.
   Formato guardado:  scrypt$N$r$p$salt_b64$hash_b64
   ------------------------------------------------------------------ */

const N = 16384; // coste de CPU/memoria (~16 MB por hash)
const R = 8;
const P = 1;
const KEYLEN = 64;

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(password).normalize('NFKC'), salt, KEYLEN, {
    N,
    r: R,
    p: P,
    maxmem: 64 * 1024 * 1024
  });
  return ['scrypt', N, R, P, salt.toString('base64'), hash.toString('base64')].join('$');
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, n, r, p, saltB64, hashB64] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const actual = scryptSync(String(password).normalize('NFKC'), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/* Comparación en tiempo constante para cadenas sueltas */
export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA); // seguimos gastando el mismo tiempo
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/* ------------------------------------------------------------------
   Tokens opacos (refresh, invitaciones…): se entregan en claro una sola
   vez y en la base de datos solo queda su SHA-256.
   ------------------------------------------------------------------ */

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = (value) => createHash('sha256').update(String(value)).digest('hex');

/* ------------------------------------------------------------------
   Política de contraseñas: longitud por encima de reglas raras de
   composición, y fuera las que están en todas las listas.
   ------------------------------------------------------------------ */

const COMMON = new Set([
  '123456789',
  '1234567890',
  'contraseña',
  'contrasena',
  'password',
  'password1',
  'passw0rd',
  'qwertyuiop',
  'administrador',
  'iloveyou1',
  '1q2w3e4r5t',
  'abc123456',
  '123123123',
  'magicthegathering',
  'planeswalker',
  'elliron2026',
  'liron2026',
  'micontraseña'
]);

export function checkPasswordPolicy(password, { email = '', name = '' } = {}) {
  const pw = String(password || '');
  if (pw.length < 10) return { ok: false, error: 'La contraseña necesita al menos 10 caracteres.' };
  if (pw.length > 200) return { ok: false, error: 'Esa contraseña es demasiado larga.' };
  if (COMMON.has(pw.toLowerCase())) return { ok: false, error: 'Esa contraseña es demasiado común, elige otra.' };
  if (/^(.)\1+$/.test(pw)) return { ok: false, error: 'No repitas el mismo carácter.' };
  if (/^(0123456789|1234567890|abcdefghij|qwertyuiop)/i.test(pw)) {
    return { ok: false, error: 'Evita las secuencias del teclado.' };
  }

  const local = String(email).split('@')[0] || '';
  if (local.length >= 4 && pw.toLowerCase().includes(local.toLowerCase())) {
    return { ok: false, error: 'La contraseña no puede contener tu correo.' };
  }
  if (String(name).length >= 4 && pw.toLowerCase().includes(String(name).toLowerCase())) {
    return { ok: false, error: 'La contraseña no puede contener tu nombre.' };
  }
  return { ok: true };
}

/* Fuerza orientativa 0-4; el front hace la misma cuenta mientras escribes */
export function passwordScore(pw = '') {
  let score = 0;
  if (pw.length >= 10) score++;
  if (pw.length >= 14) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^\w\s]/.test(pw)) score++;
  return Math.min(4, score);
}

/* ------------------------------------------------------------------
   Validaciones varias
   ------------------------------------------------------------------ */

export const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) && email.length <= 254;
}

/** Recorta y limpia el texto libre que después se pinta en la web */
export function clean(value, max = 200) {
  return String(value ?? '')
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code > 31 || code === 10 || code === 9;
    })
    .join('')
    .trim()
    .slice(0, max);
}
