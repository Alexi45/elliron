/* Limitador en memoria por ventana deslizante. Suficiente para un único
   proceso; si algún día hay varias instancias, esto se cambia por Redis. */

const buckets = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of buckets) {
    const alive = hits.filter((t) => t > now);
    if (alive.length === 0) buckets.delete(key);
    else buckets.set(key, alive);
  }
}, 60_000).unref();

export function hit(key, windowMs, max) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => t > now);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return { allowed: false, retryAfter: Math.ceil((hits[0] - now) / 1000) };
  }
  hits.push(now + windowMs);
  buckets.set(key, hits);
  return { allowed: true, retryAfter: 0 };
}

export const reset = (key) => buckets.delete(key);

export const clientIp = (req) => req.ip || req.socket?.remoteAddress || 'desconocida';

/** Middleware: limita por IP y, si se indica, también por un campo del cuerpo */
export function rateLimit({ windowMs, max, name, keyFrom }) {
  return (req, res, next) => {
    const extra = keyFrom ? `:${String(keyFrom(req) || '').slice(0, 120)}` : '';
    const result = hit(`${name}:${clientIp(req)}${extra}`, windowMs, max);
    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter);
      return res.status(429).json({
        error: `Demasiados intentos. Vuelve a probar en ${Math.max(1, Math.ceil(result.retryAfter / 60))} min.`
      });
    }
    next();
  };
}
