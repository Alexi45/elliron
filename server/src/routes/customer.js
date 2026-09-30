import express from 'express';
import { allSettings, db } from '../db.js';
import { audit } from '../audit.js';
import { rateLimit } from '../ratelimit.js';
import { checkStanding, requireAuth } from '../auth.js';
import { clean } from '../security.js';

export function customerRouter(push) {
  const router = express.Router();
  const ZONES = ['juego', 'torneo', 'cafeteria'];

  /* ---------------------------------------------------------------- reservas */

  const toMinutes = (hhmm) => {
    const [h, m] = String(hhmm).split(':').map(Number);
    return h * 60 + (m || 0);
  };

  /** ¿La fecha y hora caen dentro del horario de la tienda? */
  function validateSlot(date, time) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'La fecha no es válida.';
    if (!/^\d{2}:\d{2}$/.test(time)) return 'La hora no es válida.';

    const when = new Date(`${date}T${time}`);
    if (Number.isNaN(when.getTime())) return 'La fecha no es válida.';
    if (when.getTime() < Date.now() - 60_000) return 'Esa fecha ya ha pasado.';
    if (when.getTime() > Date.now() + 60 * 86400_000) return 'Solo aceptamos reservas con dos meses de antelación.';

    const settings = allSettings();
    const dayIndex = (when.getDay() + 6) % 7; // 0 = lunes
    const day = (settings.hours || [])[dayIndex];
    if (!day || day.closed) return 'Ese día la tienda está cerrada.';

    const start = toMinutes(day.open);
    const end = toMinutes(day.close);
    const minutes = toMinutes(time);
    const inside = end <= start ? minutes >= start || minutes < end : minutes >= start && minutes < end;
    if (!inside) return `Ese día abrimos de ${day.open} a ${day.close}.`;
    return null;
  }

  router.post(
    '/reservations',
    requireAuth,
    rateLimit({ name: 'reserva', windowMs: 60 * 60_000, max: 10 }),
    (req, res) => {
      const veto = checkStanding(req.user);
      if (veto.blocked) return res.status(403).json({ error: veto.message });

      const settings = allSettings();
      if (settings.reservations_open === false) {
        return res.status(403).json({ error: 'Ahora mismo no aceptamos reservas por la web.' });
      }

      const date = clean(req.body?.date, 10);
      const time = clean(req.body?.time, 5);
      const people = Number(req.body?.people) || 0;
      const zone = ZONES.includes(req.body?.zone) ? req.body.zone : 'juego';
      const maxPeople = Number(settings.reservation_max_people) || 8;

      const slotError = validateSlot(date, time);
      if (slotError) return res.status(400).json({ error: slotError });
      if (people < 1 || people > maxPeople) {
        return res.status(400).json({ error: `Dinos cuánta gente sois (de 1 a ${maxPeople}).` });
      }

      const pending = db
        .prepare("SELECT COUNT(*) AS n FROM reservations WHERE user_id = ? AND status = 'pendiente'")
        .get(req.user.id).n;
      if (pending >= 3) {
        return res.status(429).json({ error: 'Ya tienes tres reservas pendientes de confirmar.' });
      }

      const info = db
        .prepare(
          `INSERT INTO reservations (user_id, name, phone, email, date, time, people, zone, activity, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          req.user.id,
          req.user.name,
          clean(req.body?.phone, 30) || req.user.phone || '',
          req.user.email,
          date,
          time,
          people,
          zone,
          clean(req.body?.activity, 60),
          clean(req.body?.note, 300)
        );

      audit('reserva-creada', { req, user: req.user, detail: `${date} ${time} · ${people} personas` });
      push();
      res.status(201).json(db.prepare('SELECT * FROM reservations WHERE id = ?').get(Number(info.lastInsertRowid)));
    }
  );

  router.get('/reservations/mine', requireAuth, (req, res) => {
    res.json(
      db
        .prepare(
          `SELECT r.*, t.name AS table_name FROM reservations r
           LEFT JOIN tables t ON t.id = r.table_id
           WHERE r.user_id = ? ORDER BY r.date DESC, r.time DESC LIMIT 50`
        )
        .all(req.user.id)
    );
  });

  router.post('/reservations/:id/cancel', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
    if (!row || row.user_id !== req.user.id) return res.status(404).json({ error: 'Esa reserva no existe.' });
    if (row.status === 'cancelada') return res.json({ ok: true });

    db.prepare("UPDATE reservations SET status = 'cancelada', decided_at = datetime('now') WHERE id = ?").run(id);
    audit('reserva-cancelada', { req, user: req.user, detail: `#${id}` });
    push();
    res.json({ ok: true });
  });

  /* ------------------------------------------------------- apuntarse a eventos */

  router.post('/events/:id/signup', requireAuth, rateLimit({ name: 'apuntarse', windowMs: 60_000, max: 20 }), (req, res) => {
    const veto = checkStanding(req.user);
    if (veto.blocked) return res.status(403).json({ error: veto.message });

    const id = Number(req.params.id);
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!event) return res.status(404).json({ error: 'Ese evento no existe.' });

    const already = db.prepare('SELECT id FROM event_signups WHERE event_id = ? AND user_id = ?').get(id, req.user.id);
    if (already) return res.status(409).json({ error: 'Ya estás apuntado.' });

    if (event.capacity > 0) {
      const signups = db.prepare('SELECT COUNT(*) AS n FROM event_signups WHERE event_id = ?').get(id).n;
      if (signups + event.taken >= event.capacity) {
        return res.status(409).json({ error: 'Se han agotado las plazas. Pregúntanos por si hay bajas.' });
      }
    }

    db.prepare('INSERT INTO event_signups (event_id, user_id, note) VALUES (?, ?, ?)').run(
      id,
      req.user.id,
      clean(req.body?.note, 200)
    );
    audit('evento-inscripcion', { req, user: req.user, detail: event.title });
    push();
    res.status(201).json({ ok: true });
  });

  router.delete('/events/:id/signup', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM event_signups WHERE event_id = ? AND user_id = ?').run(id, req.user.id);
    audit('evento-baja', { req, user: req.user, detail: `evento ${id}` });
    push();
    res.json({ ok: true });
  });

  /** Los ids de los eventos a los que va este usuario, para pintar el botón */
  router.get('/events/mine', requireAuth, (req, res) => {
    const rows = db
      .prepare(
        `SELECT e.* FROM event_signups s JOIN events e ON e.id = s.event_id
         WHERE s.user_id = ? ORDER BY e.starts_at`
      )
      .all(req.user.id);
    res.json({ ids: rows.map((r) => r.id), events: rows });
  });

  return router;
}
