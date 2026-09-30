import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { prettyDate, RESERVATION_LABEL, ZONE_LABEL } from '../../lib/format';
import type { GameTable, Reservation, ReservationStatus } from '../../lib/types';
import type { Runner } from './AdminShell';

const FILTERS: { key: string; label: string }[] = [
  { key: 'pendiente', label: 'Por confirmar' },
  { key: 'confirmada', label: 'Confirmadas' },
  { key: '', label: 'Todas las próximas' },
  { key: 'historial', label: 'Historial' }
];

export function ReservasAdmin({ tables, run }: { tables: GameTable[]; run: Runner }) {
  const [filter, setFilter] = useState('pendiente');
  const [rows, setRows] = useState<Reservation[] | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const params = filter === 'historial' ? { scope: 'todas' } : filter ? { status: filter } : {};
    setRows(await api.admin.reservations.list(params));
  }, [filter]);

  useEffect(() => {
    load().catch(() => setRows([]));
  }, [load]);

  const act = (fn: () => Promise<unknown>, msg: string) => run(fn, msg).then(load);

  return (
    <>
      <div className="admin-row" style={{ marginBottom: 18, gap: 10 }}>
        <div className="filters">
          {FILTERS.map((f) => (
            <button key={f.key} className={`chip ${filter === f.key ? 'is-active' : ''}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <button className="btn btn--primary btn--sm" style={{ marginLeft: 'auto' }} onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancelar' : '+ Apuntar reserva'}
        </button>
      </div>

      {adding && <NuevaReserva tables={tables} onDone={() => { setAdding(false); load(); }} run={run} />}

      {!rows ? (
        <div className="skeleton" />
      ) : rows.length === 0 ? (
        <div className="empty">No hay reservas aquí.</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map((r) => (
            <ReservaCard key={r.id} reservation={r} tables={tables} act={act} />
          ))}
        </div>
      )}
    </>
  );
}

function ReservaCard({
  reservation: r,
  tables,
  act
}: {
  reservation: Reservation;
  tables: GameTable[];
  act: (fn: () => Promise<unknown>, msg: string) => Promise<void>;
}) {
  const [reply, setReply] = useState(r.reply);
  const [open, setOpen] = useState(false);

  const setStatus = (status: ReservationStatus) =>
    act(() => api.admin.reservations.update(r.id, { status, reply }), `Reserva ${RESERVATION_LABEL[status].toLowerCase()}`);

  return (
    <article className={`card reservation reservation--${r.status}`}>
      <div className="reservation__row">
        <div className="reservation__when">
          <strong>{prettyDate(r.date)}</strong>
          <span>{r.time}</span>
        </div>

        <div className="reservation__who">
          <strong>{r.name}</strong>
          <small>
            {r.people} personas · {ZONE_LABEL[r.zone]}
            {r.activity ? ` · ${r.activity}` : ''}
            {r.table_name ? ` · ${r.table_name}` : ''}
          </small>
          {(r.phone || r.user_email || r.email) && (
            <small className="reservation__contact">{[r.phone, r.user_email || r.email].filter(Boolean).join(' · ')}</small>
          )}
          {r.note && <small className="reservation__note">«{r.note}»</small>}
        </div>

        <div className="reservation__actions">
          <span className={`badge badge--${r.status}`}>{RESERVATION_LABEL[r.status]}</span>
          {r.status === 'pendiente' && (
            <>
              <button className="btn btn--primary btn--sm" onClick={() => setStatus('confirmada')}>Confirmar</button>
              <button className="mini-btn mini-btn--danger" onClick={() => setStatus('rechazada')}>No podemos</button>
            </>
          )}
          {r.status === 'confirmada' && (
            <>
              <button className="mini-btn" onClick={() => setStatus('cumplida')}>Vinieron</button>
              <button
                className="mini-btn mini-btn--danger"
                title="Apunta una falta a su nombre"
                onClick={() => {
                  if (confirm(`¿Apuntar que ${r.name} no apareció? Le queda una falta registrada.`)) setStatus('ausente');
                }}
              >
                No vino
              </button>
            </>
          )}
          <button className="mini-btn" onClick={() => setOpen((v) => !v)}>{open ? 'Cerrar' : 'Detalles'}</button>
        </div>
      </div>

      {open && (
        <div className="reservation__panel">
          <div className="form-grid">
            <div className="field">
              <label>Mesa asignada</label>
              <select
                className="select"
                value={r.table_id ?? ''}
                onChange={(e) => act(() => api.admin.reservations.update(r.id, { table_id: e.target.value || null }), 'Mesa asignada')}
              >
                <option value="">Sin asignar</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.seats}p)</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Hora</label>
              <input
                className="input"
                type="time"
                defaultValue={r.time}
                onBlur={(e) => e.target.value !== r.time && act(() => api.admin.reservations.update(r.id, { time: e.target.value }), 'Hora cambiada')}
              />
            </div>
            <div className="field">
              <label>Personas</label>
              <input
                className="input"
                type="number"
                min={1}
                defaultValue={r.people}
                onBlur={(e) =>
                  Number(e.target.value) !== r.people &&
                  act(() => api.admin.reservations.update(r.id, { people: Number(e.target.value) }), 'Actualizada')
                }
              />
            </div>
          </div>

          <div className="field">
            <label>Mensaje para el cliente (lo ve en su cuenta)</label>
            <input
              className="input"
              value={reply}
              placeholder="Os guardamos la mesa grande, venid antes de las 19:30"
              onChange={(e) => setReply(e.target.value)}
              onBlur={() => reply !== r.reply && act(() => api.admin.reservations.update(r.id, { reply }), 'Mensaje guardado')}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="mini-btn" onClick={() => setStatus('pendiente')}>Volver a pendiente</button>
            <button
              className="mini-btn mini-btn--danger"
              onClick={() => {
                if (confirm('¿Borrar la reserva del todo?')) act(() => api.admin.reservations.remove(r.id), 'Reserva borrada');
              }}
            >
              Borrar
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function NuevaReserva({ tables, onDone, run }: { tables: GameTable[]; onDone: () => void; run: Runner }) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    date: new Date().toISOString().slice(0, 10),
    time: '19:00',
    people: 4,
    zone: 'juego',
    activity: '',
    note: '',
    table_id: ''
  });

  return (
    <div className="card panel" style={{ marginBottom: 18 }}>
      <h3>Apuntar una reserva de teléfono o de barra</h3>
      <div className="form-grid">
        <div className="field">
          <label>Nombre</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label>Teléfono</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="field">
          <label>Día</label>
          <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div className="field">
          <label>Hora</label>
          <input className="input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        </div>
        <div className="field">
          <label>Personas</label>
          <input
            className="input"
            type="number"
            min={1}
            value={form.people}
            onChange={(e) => setForm({ ...form, people: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>Zona</label>
          <select className="select" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })}>
            {(['juego', 'torneo', 'cafeteria'] as const).map((z) => (
              <option key={z} value={z}>{ZONE_LABEL[z]}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Mesa</label>
          <select className="select" value={form.table_id} onChange={(e) => setForm({ ...form, table_id: e.target.value })}>
            <option value="">Sin asignar</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>A qué vienen</label>
          <input className="input" value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label>Nota</label>
        <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      </div>
      <button
        className="btn btn--primary btn--sm"
        disabled={!form.name.trim()}
        onClick={() => run(() => api.admin.reservations.create(form), 'Reserva apuntada').then(onDone)}
      >
        Guardar reserva
      </button>
    </div>
  );
}
