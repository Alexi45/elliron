import { getStore } from '@netlify/blobs';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/* ==========================================================================
   El servidor de la web en Netlify.

   Netlify no deja un Node encendido todo el rato, así que aquí vive solo lo
   que necesita la web informativa: el catálogo de productos, sus fotos y el
   acceso del administrador. Las mesas en vivo, las reservas y las cuentas de
   cliente siguen en `server/`, listas para cuando la tienda reabra y se
   ponga en un servidor de verdad.
   ========================================================================== */

const CATEGORIES = ['magic', 'mesa', 'libros', 'manga', 'merch', 'otros'];
const STOCK = ['disponible', 'pocas', 'agotado', 'encargo'];
const FORMATS = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
const COOKIE = '__Secure-liron_rt';
const ACCESS_MIN = 30;
const REFRESH_DAYS = 30;

const AJUSTES_POR_DEFECTO = {
  name: 'El Lirón',
  tagline: 'Juegos, café y libros · Montequinto',
  address: 'C. Venecia, 6 · Local 18, Montequinto, Dos Hermanas (Sevilla)',
  maps_url: 'https://maps.google.com/?q=El+Lir%C3%B3n+Calle+Venecia+6+Montequinto+Dos+Hermanas',
  instagram: 'https://www.instagram.com/el_liron/',
  tiktok: 'https://www.tiktok.com/@el_liron',
  whatsapp: '',
  phone: '',
  email: '',
  store_mode: 'auto',
  notice: '',
  site_mode: 'catalogo',
  registration_open: false,
  catalog_title: 'Nuestro catálogo',
  catalog_intro: 'Todo lo que tenemos en la tienda: Magic, juegos de mesa, libros y manga. Los precios son los de tienda.',
  order_phone: '614060947',
  order_area: 'Montequinto',
  order_notice: 'Háblanos si quieres cualquier producto y te lo llevamos.',
  reservations_open: false,
  reservation_max_people: 8,
  strikes_before_ban: 3,
  require_2fa_staff: false,
  hours: [
    { closed: true, open: '16:30', close: '22:00' },
    { closed: false, open: '16:30', close: '22:00' },
    { closed: false, open: '16:30', close: '22:00' },
    { closed: false, open: '16:30', close: '22:30' },
    { closed: false, open: '16:30', close: '23:00' },
    { closed: false, open: '11:00', close: '23:00' },
    { closed: false, open: '11:00', close: '21:00' }
  ]
};

/* ------------------------------------------------------------------ datos */

const datos = () => getStore({ name: 'liron', consistency: 'strong' });
const fotos = () => getStore({ name: 'liron-fotos', consistency: 'strong' });

async function leerCatalogo() {
  const guardado = await datos().get('catalogo', { type: 'json' });
  return {
    settings: { ...AJUSTES_POR_DEFECTO, ...(guardado?.settings ?? {}) },
    products: guardado?.products ?? [],
    nextId: guardado?.nextId ?? 1
  };
}

const guardarCatalogo = (estado) => datos().setJSON('catalogo', estado);

/* ------------------------------------------------------------- seguridad */

const SECRET = process.env.JWT_SECRET || '';
const base64url = (buf) => Buffer.from(buf).toString('base64url');

function firmar(payload, minutos) {
  const cuerpo = { ...payload, exp: Math.floor(Date.now() / 1000) + minutos * 60 };
  const head = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(cuerpo));
  const firma = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${firma}`;
}

function verificar(token) {
  try {
    const [head, body, firma] = String(token).split('.');
    const esperada = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
    const a = Buffer.from(firma);
    const b = Buffer.from(esperada);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    return payload.exp * 1000 > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

/** Contraseña del administrador: se acepta en claro o ya cifrada con scrypt */
function claveCorrecta(intento) {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash) {
    try {
      const [, n, r, p, salt, esperado] = hash.split('$');
      const bufEsperado = Buffer.from(esperado, 'base64');
      const real = scryptSync(String(intento).normalize('NFKC'), Buffer.from(salt, 'base64'), bufEsperado.length, {
        N: Number(n),
        r: Number(r),
        p: Number(p),
        maxmem: 64 * 1024 * 1024
      });
      return timingSafeEqual(real, bufEsperado);
    } catch {
      return false;
    }
  }
  const plano = process.env.ADMIN_PASSWORD || '';
  const a = Buffer.from(String(intento));
  const b = Buffer.from(plano);
  return plano.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

const ADMIN = () => ({
  id: 1,
  email: (process.env.ADMIN_EMAIL || 'hola@elliron.es').toLowerCase(),
  name: process.env.ADMIN_NAME || 'Equipo El Lirón',
  role: 'admin',
  phone: '',
  createdAt: '',
  lastLoginAt: null,
  standing: 'ok',
  standingNote: '',
  standingUntil: null,
  twoFactor: false
});

function esAdmin(req) {
  const cabecera = req.headers.get('authorization') || '';
  if (!cabecera.startsWith('Bearer ')) return false;
  const claims = verificar(cabecera.slice(7));
  return claims?.role === 'admin' && claims.purpose === 'access';
}

/* -------------------------------------------------------------- utilidades */

const limpiar = (valor, max = 200) =>
  String(valor ?? '')
    .split('')
    .filter((ch) => ch.charCodeAt(0) > 31 || ch === '\n')
    .join('')
    .trim()
    .slice(0, max);

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra }
  });

const error = (mensaje, status = 400) => json({ error: mensaje }, status);

/** Igual que en el servidor de casa: abierto según el horario, en hora de Madrid */
function estadoTienda(settings) {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date());
  const get = (t) => Number(partes.find((p) => p.type === t).value);
  const dow = new Date(Date.UTC(get('year'), get('month') - 1, get('day'))).getUTCDay();
  const dayIndex = (dow + 6) % 7;
  const DAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const hoy = settings.hours?.[dayIndex] ?? { closed: true };
  const minutos = get('hour') * 60 + get('minute');
  const aMin = (t) => Number(String(t).split(':')[0]) * 60 + Number(String(t).split(':')[1] || 0);

  let open = false;
  if (!hoy.closed) {
    const ini = aMin(hoy.open);
    const fin = aMin(hoy.close);
    open = fin <= ini ? minutos >= ini || minutos < fin : minutos >= ini && minutos < fin;
  }
  if (settings.store_mode === 'abierto') open = true;
  if (settings.store_mode === 'cerrado') open = false;

  return {
    open,
    manual: settings.store_mode !== 'auto',
    mode: settings.store_mode,
    closingSoon: false,
    today: hoy.closed ? null : { open: hoy.open, close: hoy.close },
    dayName: DAYS[dayIndex],
    closesAt: hoy.closed ? null : hoy.close,
    nextOpen: null,
    now: `${String(get('hour')).padStart(2, '0')}:${String(get('minute')).padStart(2, '0')}`
  };
}

const VACIO = {
  tables: [],
  summary: { total: 0, free: 0, occupied: 0, reserved: 0, freeSeats: 0, byZone: [] },
  events: [],
  menu: []
};

/* ------------------------------------------------------------------ rutas */

export default async function handler(req) {
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^\/(\.netlify\/functions\/api|api)/, '') || '/';
  const metodo = req.method;

  if (!SECRET) return error('Falta configurar JWT_SECRET en Netlify.', 500);

  try {
    /* ---------------------------------------------------------- público */

    if (ruta === '/health') return json({ ok: true });

    if (ruta === '/state' && metodo === 'GET') {
      const { settings, products } = await leerCatalogo();
      return json({ ...VACIO, settings, store: estadoTienda(settings), products, updatedAt: new Date().toISOString() });
    }

    // Las fotos viven en el almacén de Netlify y salen por aquí
    if (ruta.startsWith('/foto/') && metodo === 'GET') {
      const clave = ruta.slice('/foto/'.length);
      const blob = await fotos().getWithMetadata(clave, { type: 'arrayBuffer' });
      if (!blob) return error('Esa foto no existe.', 404);
      return new Response(blob.data, {
        headers: {
          'content-type': String(blob.metadata?.type || 'image/webp'),
          'cache-control': 'public, max-age=31536000, immutable'
        }
      });
    }

    /* ----------------------------------------------------------- acceso */

    if (ruta === '/auth/login' && metodo === 'POST') {
      const { email, password } = await req.json().catch(() => ({}));
      const correcto =
        String(email || '').trim().toLowerCase() === ADMIN().email && claveCorrecta(password);

      // Mismo mensaje siempre: no se puede averiguar qué correo vale
      if (!correcto) return error('Correo o contraseña incorrectos.', 401);

      const refresh = firmar({ role: 'admin', purpose: 'refresh' }, REFRESH_DAYS * 24 * 60);
      return json(
        { accessToken: firmar({ role: 'admin', purpose: 'access' }, ACCESS_MIN), user: ADMIN() },
        200,
        {
          'set-cookie': `${COOKIE}=${refresh}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=${REFRESH_DAYS * 86400}`
        }
      );
    }

    if (ruta === '/auth/refresh' && metodo === 'POST') {
      const cookie = (req.headers.get('cookie') || '').match(new RegExp(`${COOKIE}=([^;]+)`));
      const claims = cookie ? verificar(cookie[1]) : null;
      if (claims?.purpose !== 'refresh') return json({ error: 'Tu sesión ha caducado.', code: 'sin-sesion' }, 401);
      return json({ accessToken: firmar({ role: 'admin', purpose: 'access' }, ACCESS_MIN), user: ADMIN() });
    }

    if (ruta === '/auth/logout' && metodo === 'POST') {
      return json({ ok: true }, 200, {
        'set-cookie': `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=0`
      });
    }

    if (ruta === '/auth/me' && metodo === 'GET') {
      if (!esAdmin(req)) return json({ error: 'Necesitas iniciar sesión.', code: 'sin-sesion' }, 401);
      return json({ user: ADMIN() });
    }

    if (ruta === '/auth/register' && metodo === 'POST') {
      return error('Ahora mismo no se pueden crear cuentas nuevas.', 403);
    }

    if (ruta === '/auth/sessions' && metodo === 'GET') return json({ sessions: [] });
    if (ruta === '/auth/2fa' && metodo === 'GET') return json({ enabled: false, backupCodesLeft: 0 });

    /* ------------------------------------------------------------ panel */

    if (ruta.startsWith('/admin/')) {
      if (!esAdmin(req)) return json({ error: 'Necesitas iniciar sesión.', code: 'sin-sesion' }, 401);
      const estado = await leerCatalogo();

      if (ruta === '/admin/products' && metodo === 'POST') {
        const b = await req.json().catch(() => ({}));
        if (!limpiar(b.name, 90)) return error('La tarjeta necesita un nombre.');

        const producto = {
          id: estado.nextId,
          name: limpiar(b.name, 90),
          category: CATEGORIES.includes(b.category) ? b.category : 'otros',
          price: limpiar(b.price, 20),
          description: limpiar(b.description, 400),
          image: limpiar(b.image, 300),
          stock: STOCK.includes(b.stock) ? b.stock : 'disponible',
          featured: b.featured ? 1 : 0,
          sort_order: estado.products.length + 1,
          created_at: new Date().toISOString()
        };
        estado.products.push(producto);
        estado.nextId += 1;
        await guardarCatalogo(estado);
        return json(producto, 201);
      }

      const editar = ruta.match(/^\/admin\/products\/(\d+)$/);
      if (editar && (metodo === 'PATCH' || metodo === 'DELETE')) {
        const id = Number(editar[1]);
        const i = estado.products.findIndex((p) => p.id === id);
        if (i === -1) return error('Esa tarjeta no existe.', 404);

        if (metodo === 'DELETE') {
          const [fuera] = estado.products.splice(i, 1);
          if (fuera.image?.startsWith('/api/foto/')) {
            await fotos().delete(fuera.image.slice('/api/foto/'.length)).catch(() => undefined);
          }
          await guardarCatalogo(estado);
          return json({ ok: true });
        }

        const b = await req.json().catch(() => ({}));
        const actual = estado.products[i];
        estado.products[i] = {
          ...actual,
          name: b.name !== undefined ? limpiar(b.name, 90) || actual.name : actual.name,
          category: CATEGORIES.includes(b.category) ? b.category : actual.category,
          price: b.price !== undefined ? limpiar(b.price, 20) : actual.price,
          description: b.description !== undefined ? limpiar(b.description, 400) : actual.description,
          image: b.image !== undefined ? limpiar(b.image, 300) : actual.image,
          stock: STOCK.includes(b.stock) ? b.stock : actual.stock,
          featured: b.featured === undefined ? actual.featured : b.featured ? 1 : 0
        };
        await guardarCatalogo(estado);
        return json(estado.products[i]);
      }

      const mover = ruta.match(/^\/admin\/products\/(\d+)\/move$/);
      if (mover && metodo === 'POST') {
        const { direction } = await req.json().catch(() => ({}));
        const orden = [...estado.products].sort((a, b) => b.featured - a.featured || a.sort_order - b.sort_order);
        const i = orden.findIndex((p) => p.id === Number(mover[1]));
        const j = direction === 'arriba' ? i - 1 : i + 1;
        if (i !== -1 && j >= 0 && j < orden.length) {
          [orden[i], orden[j]] = [orden[j], orden[i]];
          orden.forEach((p, k) => {
            p.sort_order = k + 1;
          });
          estado.products = orden;
          await guardarCatalogo(estado);
        }
        return json({ ok: true });
      }

      if (ruta === '/admin/products/image' && metodo === 'POST') {
        const { dataUrl } = await req.json().catch(() => ({}));
        const match = String(dataUrl || '').match(/^data:([a-z/+-]+);base64,(.+)$/i);
        if (!match) return error('Esa imagen no se entiende.');

        const tipo = match[1].toLowerCase();
        if (!FORMATS[tipo]) return error('Solo admitimos JPG, PNG o WebP.');

        const bytes = Buffer.from(match[2], 'base64');
        if (bytes.length > 4 * 1024 * 1024) return error('La foto pesa demasiado.', 413);

        const clave = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${FORMATS[tipo]}`;
        await fotos().set(clave, bytes, { metadata: { type: tipo } });
        return json({ url: `/api/foto/${clave}` }, 201);
      }

      if (ruta === '/admin/settings' && metodo === 'PATCH') {
        const b = await req.json().catch(() => ({}));

        // En Netlify solo vive el catálogo: dejar la web «completa» la dejaría vacía
        if (b.site_mode === 'completo') {
          return error(
            'Aquí solo funciona el catálogo. Para volver a las mesas, los torneos y las reservas hay que poner la web en un servidor con Node.',
            409
          );
        }
        if (b.registration_open === true) {
          return error('El registro de clientes necesita el servidor completo, no funciona en Netlify.', 409);
        }

        for (const [clave, valor] of Object.entries(b)) {
          if (clave in AJUSTES_POR_DEFECTO) estado.settings[clave] = valor;
        }
        await guardarCatalogo(estado);
        return json(estado.settings);
      }

      if (ruta === '/admin/overview' && metodo === 'GET') {
        return json({
          store: estadoTienda(estado.settings),
          summary: VACIO.summary,
          reservations: { pending: 0, today: 0, week: 0 },
          nextReservations: [],
          users: { total: 0, week: 0, staff: 1 },
          events: [],
          signupsTotal: 0,
          strikes: { people: 0, banned: 0, month: 0 },
          activity: []
        });
      }

      return error('Esa parte del panel necesita el servidor completo, no está en Netlify.', 501);
    }

    return error('Ese recurso no existe.', 404);
  } catch (err) {
    console.error(err);
    return error('Algo ha fallado en el servidor.', 500);
  }
}

export const config = { path: '/api/*' };
