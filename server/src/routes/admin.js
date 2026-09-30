import express from 'express';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { DEFAULT_SETTINGS, db, getSetting, setSetting } from '../db.js';
import { audit, recentAudit } from '../audit.js';
import { publicUser, requireRole, revokeAllForUser } from '../auth.js';
import { buildState, madridNow } from '../state.js';
import { checkPasswordPolicy, clean, hashPassword, isValidEmail, normalizeEmail } from '../security.js';

const STATUSES = ['libre', 'ocupada', 'reservada', 'fuera'];
const ZONES = ['juego', 'torneo', 'cafeteria'];
const RESERVATION_STATUS = ['pendiente', 'confirmada', 'rechazada', 'cancelada', 'cumplida', 'ausente'];
const SEVERITIES = ['aviso', 'falta', 'grave'];
const ROLES = ['user', 'staff', 'admin'];

/* --- catálogo --- */
const CATEGORIES = ['magic', 'mesa', 'libros', 'manga', 'merch', 'otros'];
const STOCK = ['disponible', 'pocas', 'agotado', 'encargo'];
const FORMATS = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

const UPLOADS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'uploads');
mkdirSync(UPLOADS, { recursive: true });

export function adminRouter(push) {
  const router = express.Router();

  // El equipo (staff) lleva el día a día; solo admin toca usuarios y ajustes
  const team = requireRole('admin', 'staff');
  const boss = requireRole('admin');

  const todayISO = () => {
    const { year, month, day } = madridNow();
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  /* ================================================================ resumen */

  router.get('/overview', team, (req, res) => {
    const state = buildState();
    const today = todayISO();

    const reservations = {
      pending: db.prepare("SELECT COUNT(*) AS n FROM reservations WHERE status = 'pendiente'").get().n,
      today: db
        .prepare("SELECT COUNT(*) AS n FROM reservations WHERE date = ? AND status IN ('pendiente','confirmada')")
        .get(today).n,
      week: db
        .prepare(
          `SELECT COUNT(*) AS n FROM reservations
           WHERE date BETWEEN ? AND date(?, '+7 days') AND status IN ('pendiente','confirmada')`
        )
        .get(today, today).n
    };

    const nextReservations = db
      .prepare(
        `SELECT r.*, t.name AS table_name FROM reservations r
         LEFT JOIN tables t ON t.id = r.table_id
         WHERE r.date >= ? AND r.status IN ('pendiente','confirmada')
         ORDER BY r.date, r.time LIMIT 8`
      )
      .all(today);

    const users = {
      total: db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
      week: db.prepare("SELECT COUNT(*) AS n FROM users WHERE created_at >= datetime('now', '-7 days')").get().n,
      staff: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role IN ('admin','staff')").get().n
    };

    const events = db
      .prepare(
        `SELECT e.*, (SELECT COUNT(*) FROM event_signups s WHERE s.event_id = e.id) AS signups
         FROM events e ORDER BY e.starts_at LIMIT 6`
      )
      .all();

    res.json({
      store: state.store,
      summary: state.summary,
      reservations,
      nextReservations,
      users,
      events,
      signupsTotal: db.prepare('SELECT COUNT(*) AS n FROM event_signups').get().n,
      strikes: {
        people: db.prepare('SELECT COUNT(DISTINCT user_id) AS n FROM incidents WHERE forgiven = 0').get().n,
        banned: db.prepare("SELECT COUNT(*) AS n FROM users WHERE standing = 'vetado'").get().n,
        month: db.prepare("SELECT COUNT(*) AS n FROM incidents WHERE happened_on >= date('now', '-30 days')").get().n
      },
      activity: req.user.role === 'admin' ? recentAudit(12) : []
    });
  });

  /* ================================================================== mesas */

  router.post('/tables', team, (req, res) => {
    const { name, zone = 'juego', seats = 4, status = 'libre', note = '', game = '' } = req.body || {};
    if (!clean(name, 40)) return res.status(400).json({ error: 'La mesa necesita un nombre.' });
    if (!ZONES.includes(zone)) return res.status(400).json({ error: 'Zona no válida.' });

    const max = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM tables').get().m;
    const info = db
      .prepare(
        `INSERT INTO tables (name, zone, seats, status, note, game, sort_order, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(
        clean(name, 40),
        zone,
        Math.min(20, Math.max(1, Number(seats) || 4)),
        STATUSES.includes(status) ? status : 'libre',
        clean(note, 120),
        clean(game, 60),
        max + 1
      );

    audit('mesa-creada', { req, detail: clean(name, 40) });
    push();
    res.status(201).json(db.prepare('SELECT * FROM tables WHERE id = ?').get(Number(info.lastInsertRowid)));
  });

  router.patch('/tables/:id', team, (req, res) => {
    const id = Number(req.params.id);
    const current = db.prepare('SELECT * FROM tables WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Esa mesa no existe.' });

    const body = req.body || {};
    if (body.status && !STATUSES.includes(body.status)) return res.status(400).json({ error: 'Estado no válido.' });
    if (body.zone && !ZONES.includes(body.zone)) return res.status(400).json({ error: 'Zona no válida.' });

    const next = {
      name: body.name !== undefined ? clean(body.name, 40) || current.name : current.name,
      zone: body.zone ?? current.zone,
      seats: body.seats !== undefined ? Math.min(20, Math.max(1, Number(body.seats) || current.seats)) : current.seats,
      status: body.status ?? current.status,
      note: body.note !== undefined ? clean(body.note, 120) : current.note,
      game: body.game !== undefined ? clean(body.game, 60) : current.game,
      free_at: body.free_at !== undefined ? (body.free_at ? clean(body.free_at, 5) : null) : current.free_at
    };

    // El cronómetro de "ocupada desde" se gestiona solo
    let occupiedSince = current.occupied_since;
    if (next.status === 'ocupada' && current.status !== 'ocupada') occupiedSince = new Date().toISOString();
    if (next.status !== 'ocupada') occupiedSince = null;
    if (next.status === 'libre' && current.status !== 'libre') {
      if (body.note === undefined) next.note = '';
      if (body.game === undefined) next.game = '';
      next.free_at = null;
    }

    db.prepare(
      `UPDATE tables SET name = ?, zone = ?, seats = ?, status = ?, note = ?, game = ?, free_at = ?,
       occupied_since = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(next.name, next.zone, next.seats, next.status, next.note, next.game, next.free_at, occupiedSince, id);

    if (body.status && body.status !== current.status) {
      audit('mesa-estado', { req, detail: `${current.name}: ${current.status} → ${body.status}` });
    }
    push();
    res.json(db.prepare('SELECT * FROM tables WHERE id = ?').get(id));
  });

  router.delete('/tables/:id', team, (req, res) => {
    const row = db.prepare('SELECT * FROM tables WHERE id = ?').get(Number(req.params.id));
    db.prepare('DELETE FROM tables WHERE id = ?').run(Number(req.params.id));
    audit('mesa-borrada', { req, detail: row?.name || req.params.id });
    push();
    res.json({ ok: true });
  });

  router.post('/tables/free-all', team, (req, res) => {
    db.prepare(
      `UPDATE tables SET status = 'libre', note = '', game = '', free_at = NULL,
       occupied_since = NULL, updated_at = datetime('now') WHERE status != 'fuera'`
    ).run();
    audit('mesas-liberadas', { req });
    push();
    res.json({ ok: true });
  });

  /* =============================================================== reservas */

  router.get('/reservations', team, (req, res) => {
    const status = RESERVATION_STATUS.includes(req.query.status) ? req.query.status : null;
    const scope = req.query.scope === 'todas' ? 'todas' : 'proximas';
    const params = [];
    let sql = `SELECT r.*, t.name AS table_name, u.email AS user_email FROM reservations r
               LEFT JOIN tables t ON t.id = r.table_id
               LEFT JOIN users u ON u.id = r.user_id WHERE 1 = 1`;

    if (status) {
      sql += ' AND r.status = ?';
      params.push(status);
    }
    if (scope === 'proximas') {
      sql += ' AND r.date >= ?';
      params.push(todayISO());
    }
    sql += ' ORDER BY r.date, r.time LIMIT 200';

    res.json(db.prepare(sql).all(...params));
  });

  router.post('/reservations', team, (req, res) => {
    const b = req.body || {};
    if (!clean(b.name, 80) || !clean(b.date, 10) || !clean(b.time, 5)) {
      return res.status(400).json({ error: 'Faltan el nombre, la fecha o la hora.' });
    }
    const info = db
      .prepare(
        `INSERT INTO reservations (name, phone, email, date, time, people, zone, activity, note, table_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmada')`
      )
      .run(
        clean(b.name, 80),
        clean(b.phone, 30),
        clean(b.email, 120),
        clean(b.date, 10),
        clean(b.time, 5),
        Math.max(1, Number(b.people) || 2),
        ZONES.includes(b.zone) ? b.zone : 'juego',
        clean(b.activity, 60),
        clean(b.note, 300),
        b.table_id ? Number(b.table_id) : null
      );
    audit('reserva-manual', { req, detail: `${clean(b.name, 80)} · ${clean(b.date, 10)}` });
    push();
    res.status(201).json(db.prepare('SELECT * FROM reservations WHERE id = ?').get(Number(info.lastInsertRowid)));
  });

  router.patch('/reservations/:id', team, (req, res) => {
    const id = Number(req.params.id);
    const current = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Esa reserva no existe.' });

    const b = req.body || {};
    if (b.status && !RESERVATION_STATUS.includes(b.status)) return res.status(400).json({ error: 'Estado no válido.' });

    const next = {
      status: b.status ?? current.status,
      table_id: b.table_id !== undefined ? (b.table_id ? Number(b.table_id) : null) : current.table_id,
      reply: b.reply !== undefined ? clean(b.reply, 300) : current.reply,
      date: b.date ? clean(b.date, 10) : current.date,
      time: b.time ? clean(b.time, 5) : current.time,
      people: b.people !== undefined ? Math.max(1, Number(b.people) || current.people) : current.people,
      note: b.note !== undefined ? clean(b.note, 300) : current.note
    };

    db.prepare(
      `UPDATE reservations SET status = ?, table_id = ?, reply = ?, date = ?, time = ?, people = ?, note = ?,
       decided_at = CASE WHEN ? != status THEN datetime('now') ELSE decided_at END WHERE id = ?`
    ).run(next.status, next.table_id, next.reply, next.date, next.time, next.people, next.note, next.status, id);

    if (b.status && b.status !== current.status) {
      audit('reserva-estado', { req, detail: `#${id} ${current.status} → ${b.status}` });
    }

    // Marcar una reserva como "no vino" apunta la falta automáticamente
    if (b.status === 'ausente' && current.status !== 'ausente' && current.user_id) {
      const yaHay = db
        .prepare("SELECT id FROM incidents WHERE kind = 'reserva' AND source_id = ?")
        .get(id);
      if (!yaHay) {
        addIncident({
          userId: current.user_id,
          name: current.name,
          kind: 'reserva',
          sourceId: id,
          title: `Reserva de ${current.people} · ${current.date} ${current.time}`,
          happenedOn: current.date,
          note: clean(b.reply, 200),
          severity: 'falta',
          req
        });
      }
    }

    push();
    res.json(db.prepare('SELECT * FROM reservations WHERE id = ?').get(id));
  });

  router.delete('/reservations/:id', team, (req, res) => {
    db.prepare('DELETE FROM reservations WHERE id = ?').run(Number(req.params.id));
    audit('reserva-borrada', { req, detail: `#${req.params.id}` });
    push();
    res.json({ ok: true });
  });

  /* ================================================================ eventos */

  const EVENT_KINDS = ['magic', 'mesa', 'rol', 'club', 'otro'];

  router.post('/events', team, (req, res) => {
    const b = req.body || {};
    if (!clean(b.title, 100) || !clean(b.starts_at, 16)) {
      return res.status(400).json({ error: 'El evento necesita título y fecha.' });
    }
    const info = db
      .prepare(
        `INSERT INTO events (title, kind, starts_at, duration, price, capacity, taken, description, featured, recurring)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        clean(b.title, 100),
        EVENT_KINDS.includes(b.kind) ? b.kind : 'otro',
        clean(b.starts_at, 16),
        clean(b.duration, 40),
        clean(b.price, 40),
        Math.max(0, Number(b.capacity) || 0),
        Math.max(0, Number(b.taken) || 0),
        clean(b.description, 800),
        b.featured ? 1 : 0,
        clean(b.recurring, 60)
      );
    audit('evento-creado', { req, detail: clean(b.title, 100) });
    push();
    res.status(201).json(db.prepare('SELECT * FROM events WHERE id = ?').get(Number(info.lastInsertRowid)));
  });

  router.patch('/events/:id', team, (req, res) => {
    const id = Number(req.params.id);
    const current = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Ese evento no existe.' });

    const b = { ...current, ...(req.body || {}) };
    db.prepare(
      `UPDATE events SET title = ?, kind = ?, starts_at = ?, duration = ?, price = ?, capacity = ?,
       taken = ?, description = ?, featured = ?, recurring = ? WHERE id = ?`
    ).run(
      clean(b.title, 100) || current.title,
      EVENT_KINDS.includes(b.kind) ? b.kind : current.kind,
      clean(b.starts_at, 16) || current.starts_at,
      clean(b.duration, 40),
      clean(b.price, 40),
      Math.max(0, Number(b.capacity) || 0),
      Math.max(0, Number(b.taken) || 0),
      clean(b.description, 800),
      b.featured ? 1 : 0,
      clean(b.recurring, 60),
      id
    );
    audit('evento-editado', { req, detail: current.title });
    push();
    res.json(db.prepare('SELECT * FROM events WHERE id = ?').get(id));
  });

  router.delete('/events/:id', team, (req, res) => {
    const row = db.prepare('SELECT * FROM events WHERE id = ?').get(Number(req.params.id));
    db.prepare('DELETE FROM events WHERE id = ?').run(Number(req.params.id));
    audit('evento-borrado', { req, detail: row?.title || req.params.id });
    push();
    res.json({ ok: true });
  });

  router.get('/events/:id/signups', team, (req, res) => {
    res.json(
      db
        .prepare(
          `SELECT s.id, s.note, s.created_at, u.id AS user_id, u.name, u.email, u.phone
           FROM event_signups s JOIN users u ON u.id = s.user_id
           WHERE s.event_id = ? ORDER BY s.created_at`
        )
        .all(Number(req.params.id))
    );
  });

  router.delete('/signups/:id', team, (req, res) => {
    db.prepare('DELETE FROM event_signups WHERE id = ?').run(Number(req.params.id));
    audit('inscripcion-borrada', { req, detail: `#${req.params.id}` });
    push();
    res.json({ ok: true });
  });

  /* ================================================================== carta */

  router.post('/menu', team, (req, res) => {
    const b = req.body || {};
    if (!clean(b.name, 80)) return res.status(400).json({ error: 'El producto necesita un nombre.' });
    const category = clean(b.category, 20) || 'cafe';
    const max = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM menu_items WHERE category = ?').get(category).m;
    const info = db
      .prepare('INSERT INTO menu_items (category, name, description, price, available, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
      .run(category, clean(b.name, 80), clean(b.description, 160), clean(b.price, 20), b.available === false ? 0 : 1, max + 1);
    audit('carta-alta', { req, detail: clean(b.name, 80) });
    push();
    res.status(201).json(db.prepare('SELECT * FROM menu_items WHERE id = ?').get(Number(info.lastInsertRowid)));
  });

  router.patch('/menu/:id', team, (req, res) => {
    const id = Number(req.params.id);
    const current = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Ese producto no existe.' });
    const b = req.body || {};
    db.prepare('UPDATE menu_items SET category = ?, name = ?, description = ?, price = ?, available = ? WHERE id = ?').run(
      clean(b.category ?? current.category, 20),
      clean(b.name ?? current.name, 80) || current.name,
      clean(b.description ?? current.description, 160),
      clean(b.price ?? current.price, 20),
      b.available === undefined ? current.available : b.available ? 1 : 0,
      id
    );
    push();
    res.json(db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id));
  });

  router.delete('/menu/:id', team, (req, res) => {
    db.prepare('DELETE FROM menu_items WHERE id = ?').run(Number(req.params.id));
    audit('carta-baja', { req, detail: `#${req.params.id}` });
    push();
    res.json({ ok: true });
  });



  /* =============================================================== catálogo */

  router.post('/products', team, (req, res) => {
    const b = req.body || {};
    if (!clean(b.name, 90)) return res.status(400).json({ error: 'La tarjeta necesita un nombre.' });

    const max = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM products').get().m;
    const info = db
      .prepare(
        `INSERT INTO products (name, category, price, description, image, stock, featured, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        clean(b.name, 90),
        CATEGORIES.includes(b.category) ? b.category : 'otros',
        clean(b.price, 20),
        clean(b.description, 400),
        clean(b.image, 300),
        STOCK.includes(b.stock) ? b.stock : 'disponible',
        b.featured ? 1 : 0,
        max + 1
      );

    audit('producto-creado', { req, detail: clean(b.name, 90) });
    push();
    res.status(201).json(db.prepare('SELECT * FROM products WHERE id = ?').get(Number(info.lastInsertRowid)));
  });

  router.patch('/products/:id', team, (req, res) => {
    const id = Number(req.params.id);
    const current = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Esa tarjeta no existe.' });
    const b = req.body || {};

    // Si cambia la foto, la anterior se borra del disco
    const nextImage = b.image !== undefined ? clean(b.image, 300) : current.image;
    if (b.image !== undefined && current.image && current.image !== nextImage) removeUpload(current.image);

    db.prepare(
      `UPDATE products SET name = ?, category = ?, price = ?, description = ?, image = ?, stock = ?,
       featured = ?, sort_order = ? WHERE id = ?`
    ).run(
      clean(b.name ?? current.name, 90) || current.name,
      CATEGORIES.includes(b.category) ? b.category : current.category,
      b.price !== undefined ? clean(b.price, 20) : current.price,
      b.description !== undefined ? clean(b.description, 400) : current.description,
      nextImage,
      STOCK.includes(b.stock) ? b.stock : current.stock,
      b.featured === undefined ? current.featured : b.featured ? 1 : 0,
      b.sort_order !== undefined ? Number(b.sort_order) || 0 : current.sort_order,
      id
    );

    push();
    res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(id));
  });

  router.delete('/products/:id', team, (req, res) => {
    const current = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id));
    if (current?.image) removeUpload(current.image);
    db.prepare('DELETE FROM products WHERE id = ?').run(Number(req.params.id));
    audit('producto-borrado', { req, detail: current?.name || req.params.id });
    push();
    res.json({ ok: true });
  });

  /** Sube el orden o lo baja, para colocar las tarjetas a mano */
  router.post('/products/:id/move', team, (req, res) => {
    const id = Number(req.params.id);
    const lista = db.prepare('SELECT id FROM products ORDER BY featured DESC, sort_order, id').all().map((r) => r.id);
    const i = lista.indexOf(id);
    const j = req.body?.direction === 'arriba' ? i - 1 : i + 1;
    if (i === -1 || j < 0 || j >= lista.length) return res.json({ ok: true });

    [lista[i], lista[j]] = [lista[j], lista[i]];
    const set = db.prepare('UPDATE products SET sort_order = ? WHERE id = ?');
    lista.forEach((pid, orden) => set.run(orden + 1, pid));
    push();
    res.json({ ok: true });
  });

  /* La foto llega ya recortada y comprimida por el navegador, en base64 */
  router.post('/products/image', team, express.json({ limit: '6mb' }), (req, res) => {
    const dataUrl = String(req.body?.dataUrl || '');
    const match = dataUrl.match(/^data:([a-z/+-]+);base64,(.+)$/i);
    if (!match) return res.status(400).json({ error: 'Esa imagen no se entiende.' });

    const extension = FORMATS[match[1].toLowerCase()];
    if (!extension) return res.status(400).json({ error: 'Solo admitimos JPG, PNG o WebP.' });

    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length > 4 * 1024 * 1024) return res.status(413).json({ error: 'La foto pesa demasiado.' });

    const nombre = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${extension}`;
    writeFileSync(join(UPLOADS, nombre), bytes);
    audit('foto-subida', { req, detail: nombre });
    res.status(201).json({ url: `/uploads/${nombre}` });
  });

  function removeUpload(url) {
    if (!/^\/uploads\/[\w.-]+$/.test(url)) return;
    try {
      unlinkSync(join(UPLOADS, url.replace('/uploads/', '')));
    } catch {
      /* si ya no está, mejor */
    }
  }

  /* ================================================================= faltas */

  /** Apunta una falta y recalcula el estado de la persona */
  function addIncident({ userId, name, kind, sourceId = null, title = '', happenedOn, note = '', severity = 'falta', req }) {
    const info = db
      .prepare(
        `INSERT INTO incidents (user_id, name, kind, source_id, title, happened_on, note, severity, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        userId,
        clean(name, 80),
        kind,
        sourceId,
        clean(title, 120),
        clean(happenedOn, 10) || todayISO(),
        clean(note, 300),
        SEVERITIES.includes(severity) ? severity : 'falta',
        req?.user?.email || ''
      );

    refreshStanding(userId);
    audit('falta-apuntada', { req, detail: `${clean(name, 80)} · ${kind}` });
    return db.prepare('SELECT * FROM incidents WHERE id = ?').get(Number(info.lastInsertRowid));
  }

  /** Sube a "aviso" solo; vetar es siempre una decisión de una persona */
  function refreshStanding(userId) {
    if (!userId) return;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user || user.standing === 'vetado') return;
    const strikes = countStrikes(userId);
    const next = strikes >= 1 ? 'aviso' : 'ok';
    if (user.standing !== next) db.prepare('UPDATE users SET standing = ? WHERE id = ?').run(next, userId);
  }

  const countStrikes = (userId) =>
    db.prepare("SELECT COUNT(*) AS n FROM incidents WHERE user_id = ? AND forgiven = 0 AND severity != 'aviso'").get(userId).n;

  /**
   * Buscador de personas para apuntar una falta. Lo puede usar todo el equipo
   * y devuelve solo lo justo: nombre, contacto y cómo va de faltas.
   */
  router.get('/people', team, (req, res) => {
    const texto = clean(req.query.q, 60);
    const like = `%${texto}%`;
    const rows = db
      .prepare(
        `SELECT u.id, u.name, u.email, u.phone, u.standing,
                (SELECT COUNT(*) FROM incidents i WHERE i.user_id = u.id AND i.forgiven = 0 AND i.severity != 'aviso') AS strikes
         FROM users u
         WHERE u.email LIKE ? OR u.name LIKE ?
         ORDER BY strikes DESC, u.name
         LIMIT 20`
      )
      .all(like, like);
    res.json(rows);
  });

  /** La lista: una fila por persona con faltas, la que se mira de un vistazo */
  router.get('/incidents', team, (req, res) => {
    const soloActivas = req.query.scope !== 'todas';
    const rows = db
      .prepare(
        `SELECT u.id, u.name, u.email, u.phone, u.standing, u.standing_note, u.standing_until, u.status,
                COUNT(i.id) FILTER (WHERE i.forgiven = 0) AS strikes,
                COUNT(i.id) AS total,
                MAX(i.happened_on) AS last_one
         FROM users u JOIN incidents i ON i.user_id = u.id
         GROUP BY u.id
         ORDER BY strikes DESC, last_one DESC`
      )
      .all()
      .filter((r) => !soloActivas || r.strikes > 0);

    const withHistory = rows.map((r) => ({
      ...r,
      incidents: db.prepare('SELECT * FROM incidents WHERE user_id = ? ORDER BY happened_on DESC, id DESC').all(r.id)
    }));

    res.json({
      people: withHistory,
      threshold: Number(getSetting('strikes_before_ban', 3)) || 3,
      banned: db
        .prepare("SELECT id, name, email, standing_note, standing_until FROM users WHERE standing = 'vetado'")
        .all()
    });
  });

  router.post('/incidents', team, (req, res) => {
    const b = req.body || {};
    const userId = Number(b.user_id) || null;
    if (!userId) return res.status(400).json({ error: 'Elige a quién se le apunta la falta.' });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'Esa persona no existe.' });

    const incident = addIncident({
      userId,
      name: user.name,
      kind: ['evento', 'reserva', 'otro'].includes(b.kind) ? b.kind : 'otro',
      sourceId: b.source_id ? Number(b.source_id) : null,
      title: b.title,
      happenedOn: b.happened_on,
      note: b.note,
      severity: b.severity,
      req
    });
    push();
    res.status(201).json(incident);
  });

  router.patch('/incidents/:id', team, (req, res) => {
    const id = Number(req.params.id);
    const current = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Esa falta no existe.' });
    const b = req.body || {};

    db.prepare('UPDATE incidents SET note = ?, severity = ?, forgiven = ? WHERE id = ?').run(
      b.note !== undefined ? clean(b.note, 300) : current.note,
      SEVERITIES.includes(b.severity) ? b.severity : current.severity,
      b.forgiven === undefined ? current.forgiven : b.forgiven ? 1 : 0,
      id
    );
    refreshStanding(current.user_id);
    audit('falta-editada', { req, detail: `#${id}${b.forgiven ? ' perdonada' : ''}` });
    push();
    res.json(db.prepare('SELECT * FROM incidents WHERE id = ?').get(id));
  });

  router.delete('/incidents/:id', team, (req, res) => {
    const current = db.prepare('SELECT * FROM incidents WHERE id = ?').get(Number(req.params.id));
    db.prepare('DELETE FROM incidents WHERE id = ?').run(Number(req.params.id));
    if (current) refreshStanding(current.user_id);
    audit('falta-borrada', { req, detail: `#${req.params.id}` });
    push();
    res.json({ ok: true });
  });

  /** Vetar o levantar el veto: decisión de administración, nunca automática */
  router.patch('/users/:id/standing', boss, (req, res) => {
    const id = Number(req.params.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: 'Esa persona no existe.' });
    if (id === req.user.id) return res.status(400).json({ error: 'No puedes vetarte a ti mismo.' });

    const standing = ['ok', 'aviso', 'vetado'].includes(req.body?.standing) ? req.body.standing : user.standing;
    const note = clean(req.body?.standing_note, 200);
    const until = req.body?.standing_until ? clean(req.body.standing_until, 10) : null;

    db.prepare('UPDATE users SET standing = ?, standing_note = ?, standing_until = ? WHERE id = ?').run(
      standing,
      note,
      standing === 'vetado' ? until : null,
      id
    );
    audit('veto', { req, detail: `${user.email}: ${standing}${until ? ` hasta ${until}` : ''}` });
    push();
    res.json({ ok: true });
  });

  /** Apuntar que alguien no apareció a un evento, desde la lista de inscritos */
  router.post('/signups/:id/no-show', team, (req, res) => {
    const row = db
      .prepare(
        `SELECT s.*, u.name AS user_name, e.title AS event_title, e.starts_at
         FROM event_signups s JOIN users u ON u.id = s.user_id JOIN events e ON e.id = s.event_id
         WHERE s.id = ?`
      )
      .get(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'Esa inscripción no existe.' });

    addIncident({
      userId: row.user_id,
      name: row.user_name,
      kind: 'evento',
      sourceId: row.event_id,
      title: row.event_title,
      happenedOn: String(row.starts_at).slice(0, 10),
      note: clean(req.body?.note, 300),
      severity: 'falta',
      req
    });

    if (req.body?.remove !== false) db.prepare('DELETE FROM event_signups WHERE id = ?').run(Number(req.params.id));
    push();
    res.json({ ok: true });
  });

  /* =============================================================== usuarios */

  router.get('/users', boss, (req, res) => {
    const q = `%${clean(req.query.q, 60)}%`;
    res.json(
      db
        .prepare(
          `SELECT u.*,
                  (SELECT COUNT(*) FROM reservations r WHERE r.user_id = u.id) AS reservations,
                  (SELECT COUNT(*) FROM event_signups s WHERE s.user_id = u.id) AS signups
           FROM users u
           WHERE u.email LIKE ? OR u.name LIKE ?
           ORDER BY u.created_at DESC LIMIT 200`
        )
        .all(q, q)
        .map((u) => ({
          ...publicUser(u),
          status: u.status,
          standing: u.standing,
          standingNote: u.standing_note,
          standingUntil: u.standing_until,
          strikes: db
            .prepare("SELECT COUNT(*) AS n FROM incidents WHERE user_id = ? AND forgiven = 0 AND severity != 'aviso'")
            .get(u.id).n,
          reservations: u.reservations,
          signups: u.signups,
          locked: Boolean(u.locked_until && new Date(u.locked_until).getTime() > Date.now())
        }))
    );
  });

  router.post('/users', boss, (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const name = clean(req.body?.name, 80);
    const role = ROLES.includes(req.body?.role) ? req.body.role : 'staff';
    const password = String(req.body?.password || '');

    if (!isValidEmail(email)) return res.status(400).json({ error: 'Ese correo no parece válido.' });
    if (!name) return res.status(400).json({ error: 'Falta el nombre.' });
    const policy = checkPasswordPolicy(password, { email, name });
    if (!policy.ok) return res.status(400).json({ error: policy.error });
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    }

    db.prepare('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)').run(
      email,
      name,
      hashPassword(password),
      role
    );
    audit('usuario-creado', { req, detail: `${email} (${role})` });
    res.status(201).json({ ok: true });
  });

  router.patch('/users/:id', boss, (req, res) => {
    const id = Number(req.params.id);
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!target) return res.status(404).json({ error: 'Ese usuario no existe.' });
    if (id === req.user.id) return res.status(400).json({ error: 'No puedes cambiarte el rol a ti mismo.' });

    const role = ROLES.includes(req.body?.role) ? req.body.role : target.role;
    const status = ['activo', 'bloqueado'].includes(req.body?.status) ? req.body.status : target.status;

    // Nunca dejar la tienda sin ningún administrador
    if (target.role === 'admin' && (role !== 'admin' || status !== 'activo')) {
      const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'activo'").get().n;
      if (admins <= 1) return res.status(400).json({ error: 'Debe quedar al menos un administrador activo.' });
    }

    db.prepare('UPDATE users SET role = ?, status = ? WHERE id = ?').run(role, status, id);
    if (status === 'bloqueado') revokeAllForUser(id);
    audit('usuario-actualizado', { req, detail: `${target.email}: ${role}/${status}` });
    res.json({ ok: true });
  });

  router.post('/users/:id/unlock', boss, (req, res) => {
    db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(Number(req.params.id));
    audit('usuario-desbloqueado', { req, detail: `#${req.params.id}` });
    res.json({ ok: true });
  });

  router.post('/users/:id/close-sessions', boss, (req, res) => {
    revokeAllForUser(Number(req.params.id));
    audit('usuario-sesiones-cerradas', { req, detail: `#${req.params.id}` });
    res.json({ ok: true });
  });

  router.delete('/users/:id', boss, (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) return res.status(400).json({ error: 'No puedes borrar tu propia cuenta.' });
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!target) return res.status(404).json({ error: 'Ese usuario no existe.' });
    if (target.role === 'admin') {
      const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
      if (admins <= 1) return res.status(400).json({ error: 'Debe quedar al menos un administrador.' });
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    audit('usuario-borrado', { req, detail: target.email });
    res.json({ ok: true });
  });

  /* ================================================================ ajustes */

  router.patch('/settings', boss, (req, res) => {
    const allowed = Object.keys(DEFAULT_SETTINGS);
    const changed = [];
    for (const [key, value] of Object.entries(req.body || {})) {
      if (!allowed.includes(key)) continue;
      setSetting(key, value);
      changed.push(key);
    }
    audit('ajustes', { req, detail: changed.join(', ') });
    push();
    res.json(buildState().settings);
  });

  router.get('/audit', boss, (req, res) => {
    res.json(recentAudit(Number(req.query.limit) || 100));
  });

  return router;
}
