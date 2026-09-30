import { db, allSettings } from './db.js';

const DAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/* Hora actual en Madrid, independientemente de dónde esté el servidor */
export function madridNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date());
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const jsDow = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = domingo
  const dayIndex = (jsDow + 6) % 7; // 0 = lunes
  return { year, month, day, hour, minute, dayIndex, minutes: hour * 60 + minute };
}

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return h * 60 + (m || 0);
};

const fmt = (mins) => `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/* ¿Está abierto ahora mismo? Contempla el modo manual del panel. */
export function computeOpenState(settings) {
  const now = madridNow();
  const hours = Array.isArray(settings.hours) ? settings.hours : [];
  const today = hours[now.dayIndex] || { closed: true };
  const mode = settings.store_mode || 'auto';

  const scheduled = (() => {
    if (today.closed) return { open: false };
    const start = toMinutes(today.open);
    const end = toMinutes(today.close);
    const crossesMidnight = end <= start;
    const open = crossesMidnight
      ? now.minutes >= start || now.minutes < end
      : now.minutes >= start && now.minutes < end;
    return { open, start, end, crossesMidnight };
  })();

  // Próxima apertura (hasta 7 días vista)
  let nextOpen = null;
  for (let i = 0; i < 8; i++) {
    const idx = (now.dayIndex + i) % 7;
    const d = hours[idx];
    if (!d || d.closed) continue;
    const start = toMinutes(d.open);
    if (i === 0 && now.minutes >= start) continue;
    nextOpen = { day: i === 0 ? 'hoy' : i === 1 ? 'mañana' : DAYS[idx], time: d.open };
    break;
  }

  let open = scheduled.open;
  let manual = false;
  if (mode === 'abierto') {
    open = true;
    manual = true;
  } else if (mode === 'cerrado') {
    open = false;
    manual = true;
  }

  const closingSoon =
    open && !today.closed && scheduled.end != null && !scheduled.crossesMidnight
      ? scheduled.end - now.minutes <= 45 && scheduled.end - now.minutes > 0
      : false;

  return {
    open,
    manual,
    mode,
    closingSoon,
    today: today.closed ? null : { open: today.open, close: today.close },
    dayName: DAYS[now.dayIndex],
    closesAt: !today.closed && scheduled.end != null ? fmt(scheduled.end) : null,
    nextOpen,
    now: `${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}`
  };
}

export function getTables() {
  return db.prepare('SELECT * FROM tables ORDER BY sort_order, id').all();
}

export function getEvents({ upcomingOnly = false } = {}) {
  const rows = db
    .prepare(
      `SELECT e.*, (SELECT COUNT(*) FROM event_signups s WHERE s.event_id = e.id) AS signups
       FROM events e ORDER BY e.starts_at`
    )
    .all()
    .map((e) => {
      const occupied = e.taken + e.signups;
      return { ...e, occupied, spotsLeft: e.capacity > 0 ? Math.max(0, e.capacity - occupied) : null };
    });
  if (!upcomingOnly) return rows;
  const now = new Date();
  const cutoff = new Date(now.getTime() - 4 * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const cutoffStr = `${cutoff.getFullYear()}-${pad(cutoff.getMonth() + 1)}-${pad(cutoff.getDate())}T${pad(cutoff.getHours())}:${pad(cutoff.getMinutes())}`;
  return rows.filter((e) => e.starts_at >= cutoffStr);
}

export function getProducts() {
  return db.prepare('SELECT * FROM products ORDER BY featured DESC, sort_order, id').all();
}

export function getMenu() {
  return db.prepare('SELECT * FROM menu_items ORDER BY category, sort_order, id').all();
}

export function buildState() {
  const settings = allSettings();
  const tables = getTables();
  const free = tables.filter((t) => t.status === 'libre');
  const playable = tables.filter((t) => t.status !== 'fuera');

  return {
    settings,
    store: computeOpenState(settings),
    tables,
    summary: {
      total: playable.length,
      free: free.length,
      occupied: tables.filter((t) => t.status === 'ocupada').length,
      reserved: tables.filter((t) => t.status === 'reservada').length,
      freeSeats: free.reduce((acc, t) => acc + t.seats, 0),
      byZone: ['juego', 'torneo', 'cafeteria'].map((zone) => ({
        zone,
        total: playable.filter((t) => t.zone === zone).length,
        free: free.filter((t) => t.zone === zone).length
      }))
    },
    events: getEvents({ upcomingOnly: true }),
    menu: getMenu(),
    products: getProducts(),
    updatedAt: new Date().toISOString()
  };
}
