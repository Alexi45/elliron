import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';
import { sha256 } from './security.js';

/* ------------------------------------------------------------------
   Verificación en dos pasos (TOTP, RFC 6238). Compatible con Google
   Authenticator, Authy, 1Password, Aegis… No hace falta ningún servicio
   externo: son seis dígitos calculados a partir de un secreto y la hora.
   ------------------------------------------------------------------ */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP = 30; // segundos por código
const DIGITS = 6;
const WINDOW = 1; // se aceptan el código anterior y el siguiente

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(input) {
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of String(input).toUpperCase().replace(/[^A-Z2-7]/g, '')) {
    value = (value << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const generateSecret = () => base32Encode(randomBytes(20));

function codeFor(secret, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

/** ¿Es válido este código ahora mismo? (acepta un paso de margen) */
export function verifyCode(secret, code) {
  const clean = String(code || '').replace(/\D/g, '');
  if (clean.length !== DIGITS || !secret) return false;

  const counter = Math.floor(Date.now() / 1000 / STEP);
  for (let drift = -WINDOW; drift <= WINDOW; drift++) {
    const expected = Buffer.from(codeFor(secret, counter + drift));
    const given = Buffer.from(clean);
    if (expected.length === given.length && timingSafeEqual(expected, given)) return true;
  }
  return false;
}

/** URI que se lee con la cámara y su QR en SVG, listo para incrustar */
export async function buildEnrolment(secret, email, issuer = 'El Lirón') {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP}`;
  const qr = await QRCode.toString(uri, {
    type: 'svg',
    margin: 1,
    color: { dark: '#101410', light: '#BBD3BB' }
  });
  return { uri, qr };
}

/* ------------------------------------------------------------------
   Códigos de respaldo: se enseñan una sola vez y se guardan hasheados.
   ------------------------------------------------------------------ */

export function generateBackupCodes(howMany = 8) {
  const codes = Array.from({ length: howMany }, () =>
    randomBytes(5)
      .toString('hex')
      .toUpperCase()
      .replace(/(.{5})/, '$1-')
  );
  return { codes, stored: JSON.stringify(codes.map((c) => sha256(c))) };
}

/** Consume un código de respaldo; devuelve el JSON actualizado o null si no vale */
export function useBackupCode(storedJson, code) {
  let hashes;
  try {
    hashes = JSON.parse(storedJson || '[]');
  } catch {
    return null;
  }
  const hash = sha256(String(code || '').trim().toUpperCase());
  const index = hashes.indexOf(hash);
  if (index === -1) return null;
  hashes.splice(index, 1);
  return JSON.stringify(hashes);
}

export const backupCodesLeft = (storedJson) => {
  try {
    return JSON.parse(storedJson || '[]').length;
  } catch {
    return 0;
  }
};
