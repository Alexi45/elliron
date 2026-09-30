import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { eventDate, KIND_LABEL, stamp } from '../../lib/format';
import type { LironEvent, Signup } from '../../lib/types';
import type { Runner } from './AdminShell';

const KINDS = ['magic', 'mesa', 'rol', 'club', 'otro'] as const;

const emptyEvent = {
  title: '',
  kind: 'magic',
  starts_at: '',
  duration: '',
  price: '',
  capacity: 0,
  taken: 0,
  description: '',
  featured: 0,
  recurring: ''
};

type EventDraft = typeof emptyEvent;

export function EventosAdmin({ events, run }: { events: LironEvent[]; run: Runner }) {
  const [draft, setDraft] = useState<EventDraft>({ ...emptyEvent });
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="admin-row" style={{ marginBottom: 18 }}>
        <button className="btn btn--primary btn--sm" onClick={() => setOpen((v) => !v)}>
          {open ? 'Cancelar' : '+ Nuevo evento'}
        </button>
        <span className="admin-hint">Las plazas suman lo que se apunta por la web y lo que apuntáis en la tienda.</span>
      </div>

      {open && (
        <div className="card panel" style={{ marginBottom: 18 }}>
          <h3>Nuevo evento</h3>
          <EventFields value={draft} onChange={setDraft} />
          <button
            className="btn btn--primary btn--sm"
            disabled={!draft.title || !draft.starts_at}
            onClick={() =>
              run(() => api.admin.events.create(draft), 'Evento publicado').then(() => {
                setDraft({ ...emptyEvent });
                setOpen(false);
              })
            }
          >
            Publicar evento
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        {events.map((e) => (
          <EventCard key={e.id} event={e} run={run} />
        ))}
        {events.length === 0 && <div className="empty">No hay eventos publicados todavía.</div>}
      </div>
    </>
  );
}

function EventCard({ event, run }: { event: LironEvent; run: Runner }) {
  const [tab, setTab] = useState<'cerrado' | 'editar' | 'inscritos'>('cerrado');
  const [draft, setDraft] = useState<EventDraft>({ ...event });
  const [signups, setSignups] = useState<Signup[] | null>(null);
  const d = eventDate(event.starts_at);

  useEffect(() => setDraft({ ...event }), [event]);

  const loadSignups = () => api.admin.events.signups(event.id).then(setSignups).catch(() => setSignups([]));

  const occupied = (event.taken ?? 0) + (event.signups ?? 0);

  return (
    <div className="card panel">
      <div className="admin-table__head">
        <div className="admin-table__name">
          {event.title}
          <span className={`kind kind--${event.kind}`}>{KIND_LABEL[event.kind]}</span>
          <small>{d.dow} {d.day} {d.month} · {d.time}</small>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className="pill" style={{ fontSize: '0.76rem', padding: '5px 11px' }}>
            {event.capacity > 0 ? `${occupied}/${event.capacity} plazas` : `${event.signups ?? 0} apuntados`}
          </span>
          <button
            className="mini-btn"
            onClick={() => {
              setTab(tab === 'inscritos' ? 'cerrado' : 'inscritos');
              if (tab !== 'inscritos') loadSignups();
            }}
          >
            Inscritos
          </button>
          <button className="mini-btn" onClick={() => setTab(tab === 'editar' ? 'cerrado' : 'editar')}>
            {tab === 'editar' ? 'Cerrar' : 'Editar'}
          </button>
          <button
            className="mini-btn mini-btn--danger"
            onClick={() => {
              if (confirm(`¿Borrar "${event.title}"?`)) run(() => api.admin.events.remove(event.id), 'Evento borrado');
            }}
          >
            Borrar
          </button>
        </div>
      </div>

      {tab === 'editar' && (
        <>
          <EventFields value={draft} onChange={setDraft} />
          <button className="btn btn--primary btn--sm" onClick={() => run(() => api.admin.events.update(event.id, draft), 'Evento actualizado')}>
            Guardar
          </button>
        </>
      )}

      {tab === 'inscritos' && (
        <div style={{ display: 'grid', gap: 8 }}>
          {!signups ? (
            <div className="skeleton" style={{ height: 70 }} />
          ) : signups.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Todavía no se ha apuntado nadie por la web.</p>
          ) : (
            signups.map((s) => (
              <div key={s.id} className="zone-row">
                <span style={{ fontSize: '0.88rem' }}>
                  <strong>{s.name}</strong>
                  <small style={{ display: 'block', color: 'var(--muted-2)', fontSize: '0.76rem' }}>
                    {s.email}
                    {s.phone ? ` · ${s.phone}` : ''} · {stamp(s.created_at)}
                  </small>
                  {s.note && <small style={{ display: 'block', color: 'var(--muted)' }}>«{s.note}»</small>}
                </span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    className="mini-btn mini-btn--danger"
                    title="Apunta una falta y lo quita de la lista"
                    onClick={() => {
                      if (confirm(`¿${s.name} no apareció? Le queda una falta registrada.`)) {
                        run(() => api.admin.incidents.noShow(s.id), 'Falta apuntada').then(loadSignups);
                      }
                    }}
                  >
                    No vino
                  </button>
                  <button
                    className="mini-btn"
                    onClick={() => run(() => api.admin.events.removeSignup(s.id), 'Inscripción quitada').then(loadSignups)}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function EventFields({ value, onChange }: { value: EventDraft; onChange: (v: EventDraft) => void }) {
  const set = (patch: Partial<EventDraft>) => onChange({ ...value, ...patch });
  return (
    <>
      <div className="form-grid">
        <div className="field">
          <label>Título</label>
          <input className="input" value={value.title} onChange={(e) => set({ title: e.target.value })} placeholder="Noche de Commander" />
        </div>
        <div className="field">
          <label>Tipo</label>
          <select className="select" value={value.kind} onChange={(e) => set({ kind: e.target.value })}>
            {KINDS.map((k) => (
              <option key={k} value={k}>{KIND_LABEL[k]}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Fecha y hora</label>
          <input className="input" type="datetime-local" value={value.starts_at} onChange={(e) => set({ starts_at: e.target.value })} />
        </div>
        <div className="field">
          <label>Duración</label>
          <input className="input" value={value.duration} onChange={(e) => set({ duration: e.target.value })} placeholder="3 h aprox." />
        </div>
        <div className="field">
          <label>Precio</label>
          <input className="input" value={value.price} onChange={(e) => set({ price: e.target.value })} placeholder="Gratis / 15 €" />
        </div>
        <div className="field">
          <label>Se repite</label>
          <input className="input" value={value.recurring} onChange={(e) => set({ recurring: e.target.value })} placeholder="Todos los jueves" />
        </div>
        <div className="field">
          <label>Plazas totales (0 = sin límite)</label>
          <input className="input" type="number" min={0} value={value.capacity} onChange={(e) => set({ capacity: Number(e.target.value) })} />
        </div>
        <div className="field">
          <label>Apuntados en tienda</label>
          <input className="input" type="number" min={0} value={value.taken} onChange={(e) => set({ taken: Number(e.target.value) })} />
        </div>
      </div>
      <div className="field">
        <label>Descripción</label>
        <textarea className="textarea" value={value.description} onChange={(e) => set({ description: e.target.value })} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '0.88rem', color: 'var(--muted)' }}>
        <input type="checkbox" checked={Boolean(value.featured)} onChange={(e) => set({ featured: e.target.checked ? 1 : 0 })} />
        Destacar en la web
      </label>
    </>
  );
}
