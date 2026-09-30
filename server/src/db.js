import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(join(DATA_DIR, 'liron.db'));

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS tables (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    zone          TEXT    NOT NULL DEFAULT 'juego',
    seats         INTEGER NOT NULL DEFAULT 4,
    status        TEXT    NOT NULL DEFAULT 'libre',
    note          TEXT    NOT NULL DEFAULT '',
    game          TEXT    NOT NULL DEFAULT '',
    free_at       TEXT,
    occupied_since TEXT,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    kind        TEXT    NOT NULL DEFAULT 'magic',
    starts_at   TEXT    NOT NULL,
    duration    TEXT    NOT NULL DEFAULT '',
    price       TEXT    NOT NULL DEFAULT '',
    capacity    INTEGER NOT NULL DEFAULT 0,
    taken       INTEGER NOT NULL DEFAULT 0,
    description TEXT    NOT NULL DEFAULT '',
    featured    INTEGER NOT NULL DEFAULT 0,
    recurring   TEXT    NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category    TEXT    NOT NULL DEFAULT 'cafe',
    name        TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    price       TEXT    NOT NULL DEFAULT '',
    available   INTEGER NOT NULL DEFAULT 1,
    sort_order  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    email          TEXT    NOT NULL UNIQUE,
    name           TEXT    NOT NULL DEFAULT '',
    password_hash  TEXT    NOT NULL,
    role           TEXT    NOT NULL DEFAULT 'user',
    status         TEXT    NOT NULL DEFAULT 'activo',
    phone          TEXT    NOT NULL DEFAULT '',
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until   TEXT,
    last_login_at  TEXT,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Refresh tokens: en la base solo vive su SHA-256
  CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT    NOT NULL UNIQUE,
    family     TEXT    NOT NULL,
    user_agent TEXT    NOT NULL DEFAULT '',
    ip         TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT    NOT NULL,
    revoked_at TEXT
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name       TEXT    NOT NULL,
    phone      TEXT    NOT NULL DEFAULT '',
    email      TEXT    NOT NULL DEFAULT '',
    date       TEXT    NOT NULL,
    time       TEXT    NOT NULL,
    people     INTEGER NOT NULL DEFAULT 2,
    zone       TEXT    NOT NULL DEFAULT 'juego',
    activity   TEXT    NOT NULL DEFAULT '',
    note       TEXT    NOT NULL DEFAULT '',
    table_id   INTEGER REFERENCES tables(id) ON DELETE SET NULL,
    status     TEXT    NOT NULL DEFAULT 'pendiente',
    reply      TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    decided_at TEXT
  );

  CREATE TABLE IF NOT EXISTS event_signups (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note       TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (event_id, user_id)
  );

  -- Catálogo: las tarjetas de producto que ve el público
  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    category    TEXT    NOT NULL DEFAULT 'magic',
    price       TEXT    NOT NULL DEFAULT '',
    description TEXT    NOT NULL DEFAULT '',
    image       TEXT    NOT NULL DEFAULT '',
    stock       TEXT    NOT NULL DEFAULT 'disponible',
    featured    INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Control de plantones: quién falla a torneos o reservas
  CREATE TABLE IF NOT EXISTS incidents (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL DEFAULT '',
    kind        TEXT    NOT NULL DEFAULT 'otro',
    source_id   INTEGER,
    title       TEXT    NOT NULL DEFAULT '',
    happened_on TEXT    NOT NULL,
    note        TEXT    NOT NULL DEFAULT '',
    severity    TEXT    NOT NULL DEFAULT 'falta',
    forgiven    INTEGER NOT NULL DEFAULT 0,
    created_by  TEXT    NOT NULL DEFAULT '',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    at      TEXT    NOT NULL DEFAULT (datetime('now')),
    user_id INTEGER,
    actor   TEXT    NOT NULL DEFAULT '',
    action  TEXT    NOT NULL,
    detail  TEXT    NOT NULL DEFAULT '',
    ip      TEXT    NOT NULL DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user     ON sessions (user_id);
  CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations (date, time);
  CREATE INDEX IF NOT EXISTS idx_signups_event     ON event_signups (event_id);
  CREATE INDEX IF NOT EXISTS idx_audit_at          ON audit_log (at DESC);
  CREATE INDEX IF NOT EXISTS idx_incidents_user    ON incidents (user_id, forgiven);
  CREATE INDEX IF NOT EXISTS idx_products_order     ON products (sort_order, id);
`);

/* Migraciones suaves: añade columnas que falten en bases ya creadas */
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

for (const [column, ddl] of [
  ['status', "TEXT NOT NULL DEFAULT 'activo'"],
  ['phone', "TEXT NOT NULL DEFAULT ''"],
  ['failed_attempts', 'INTEGER NOT NULL DEFAULT 0'],
  ['locked_until', 'TEXT'],
  ['last_login_at', 'TEXT'],
  // control de plantones: 'ok' | 'aviso' | 'vetado'
  ['standing', "TEXT NOT NULL DEFAULT 'ok'"],
  ['standing_note', "TEXT NOT NULL DEFAULT ''"],
  ['standing_until', 'TEXT'],
  // verificación en dos pasos (TOTP)
  ['totp_secret', 'TEXT'],
  ['totp_enabled', 'INTEGER NOT NULL DEFAULT 0'],
  ['totp_backup', 'TEXT']
]) {
  ensureColumn('users', column, ddl);
}

/* ---------- helpers de settings ---------- */

const getSettingStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
const setSettingStmt = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
);

export function getSetting(key, fallback = null) {
  const row = getSettingStmt.get(key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

export function setSetting(key, value) {
  setSettingStmt.run(key, JSON.stringify(value));
}

export function allSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value);
    } catch {
      out[r.key] = r.value;
    }
  }
  return out;
}

export const DEFAULT_SETTINGS = {
  // Datos públicos de la tienda (editables desde el panel)
  name: 'El Lirón',
  tagline: 'Juegos, café y libros · Montequinto',
  address: 'C. Venecia, 6 · Local 18, Montequinto, Dos Hermanas (Sevilla)',
  maps_url: 'https://maps.google.com/?q=El+Lir%C3%B3n+Calle+Venecia+6+Montequinto+Dos+Hermanas',
  instagram: 'https://www.instagram.com/el_liron/',
  tiktok: 'https://www.tiktok.com/@el_liron',
  whatsapp: '',
  phone: '',
  email: '',
  // 'auto' usa el horario; 'abierto'/'cerrado' lo fuerzan a mano desde el panel
  store_mode: 'auto',
  notice: '',
  /* 'catalogo' enseña solo el escaparate de productos y esconde mesas, torneos,
     reservas y carta. 'completo' devuelve la web entera cuando la tienda reabra. */
  site_mode: 'catalogo',
  // ¿puede la gente crearse una cuenta? Con la tienda cerrada, no
  registration_open: false,
  // Cabecera del escaparate
  catalog_title: 'Nuestro catálogo',
  catalog_intro: 'Todo lo que tenemos en la tienda: Magic, juegos de mesa, libros y manga. Los precios son los de tienda.',
  // Pedidos: el teléfono al que escribe la gente y hasta dónde llevamos
  order_phone: '614060947',
  order_area: 'Montequinto',
  order_notice: 'Háblanos si quieres cualquier producto y te lo llevamos.',
  // ¿se aceptan reservas de mesa desde la web?
  reservations_open: true,
  reservation_max_people: 8,
  // faltas antes de que el panel recomiende vetar a alguien
  strikes_before_ban: 3,
  // exigir verificación en dos pasos a las cuentas del equipo
  require_2fa_staff: false,
  // 0 = lunes ... 6 = domingo
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

export function ensureSettings() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (getSettingStmt.get(key) === undefined) setSetting(key, value);
  }
}

ensureSettings();
