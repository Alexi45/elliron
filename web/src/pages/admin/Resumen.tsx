import { api } from '../../lib/api';
import { ACTION_LABEL, eventDate, prettyDate, RESERVATION_LABEL, stamp, ZONE_LABEL } from '../../lib/format';
import type { AppState, Overview } from '../../lib/types';
import type { Runner, Section } from './AdminShell';

interface Props {
  overview: Overview | null;
  state: AppState;
  run: Runner;
  onGo: (section: Section) => void;
}

export function Resumen({ overview, state, run, onGo }: Props) {
  const { summary } = state;
  const occupancy = summary.total ? Math.round(((summary.total - summary.free) / summary.total) * 100) : 0;

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      {/* --------------------------------------------------------- cifras */}
      <div className="kpis">
        <article className="card kpi kpi--free">
          <span className="kpi__label">Mesas libres</span>
          <strong className="kpi__num">{summary.free}</strong>
          <small>de {summary.total} · {summary.freeSeats} sitios</small>
          <div className="bar" style={{ marginTop: 12 }}>
            <div className="bar__fill" style={{ width: `${summary.total ? (summary.free / summary.total) * 100 : 0}%` }} />
          </div>
        </article>

        <article className="card kpi kpi--busy">
          <span className="kpi__label">Sala ocupada</span>
          <strong className="kpi__num">{occupancy}%</strong>
          <small>{summary.occupied} jugando · {summary.reserved} reservadas</small>
        </article>

        <article className="card kpi kpi--gold">
          <span className="kpi__label">Reservas por confirmar</span>
          <strong className="kpi__num">{overview?.reservations.pending ?? '—'}</strong>
          <small>{overview?.reservations.today ?? 0} hoy · {overview?.reservations.week ?? 0} esta semana</small>
          {(overview?.reservations.pending ?? 0) > 0 && (
            <button className="mini-btn" style={{ marginTop: 12, justifySelf: 'start' }} onClick={() => onGo('reservas')}>
              Revisarlas
            </button>
          )}
        </article>

        <article className="card kpi kpi--plum">
          <span className="kpi__label">Clientes registrados</span>
          <strong className="kpi__num">{overview?.users.total ?? '—'}</strong>
          <small>+{overview?.users.week ?? 0} esta semana · {overview?.signupsTotal ?? 0} inscripciones</small>
        </article>

        <article className="card kpi kpi--clay">
          <span className="kpi__label">Gente que ha fallado</span>
          <strong className="kpi__num">{overview?.strikes.people ?? '—'}</strong>
          <small>
            {overview?.strikes.month ?? 0} faltas este mes
            {overview && overview.strikes.banned > 0 ? ` · ${overview.strikes.banned} vetados` : ''}
          </small>
          <button className="mini-btn" style={{ marginTop: 12, justifySelf: 'start' }} onClick={() => onGo('faltas')}>
            Ver la lista
          </button>
        </article>
      </div>

      {/* ------------------------------------------------- acciones rápidas */}
      <div className="card panel">
        <h3>Atajos de barra</h3>
        <div className="quick-actions">
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => {
              if (confirm('¿Marcar todas las mesas como libres?')) run(() => api.admin.tables.freeAll(), 'Sala vacía');
            }}
          >
            Liberar todas las mesas
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => run(() => api.admin.settings.update({ store_mode: 'abierto' }), 'La web dice: abierto')}
          >
            Abrir la tienda
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => run(() => api.admin.settings.update({ store_mode: 'cerrado' }), 'La web dice: cerrado')}
          >
            Cerrar la tienda
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => run(() => api.admin.settings.update({ store_mode: 'auto' }), 'Vuelve a mandar el horario')}
          >
            Volver al horario
          </button>
        </div>
        <p style={{ color: 'var(--muted-2)', fontSize: '0.82rem' }}>
          Ahora mismo la web dice que estáis <strong style={{ color: state.store.open ? 'var(--free)' : 'var(--busy)' }}>
            {state.store.open ? 'abiertos' : 'cerrados'}
          </strong>
          {state.store.manual ? ' (forzado a mano)' : ' según el horario'}.
        </p>
      </div>

      <div className="two-col">
        {/* ------------------------------------------------ próximas reservas */}
        <div className="card panel">
          <h3>Lo que viene</h3>
          {!overview || overview.nextReservations.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No hay reservas apuntadas.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {overview.nextReservations.map((r) => (
                <div key={r.id} className="zone-row">
                  <span style={{ fontSize: '0.88rem' }}>
                    <strong>{r.name}</strong>
                    <small style={{ color: 'var(--muted-2)', display: 'block', fontSize: '0.76rem' }}>
                      {prettyDate(r.date)} · {r.time} · {r.people}p · {ZONE_LABEL[r.zone]}
                    </small>
                  </span>
                  <span className={`badge badge--${r.status}`}>{RESERVATION_LABEL[r.status]}</span>
                </div>
              ))}
            </div>
          )}
          <button className="mini-btn" style={{ justifySelf: 'start' }} onClick={() => onGo('reservas')}>
            Ver todas
          </button>
        </div>

        {/* ---------------------------------------------- próximos eventos */}
        <div className="card panel">
          <h3>Torneos y eventos</h3>
          {!overview || overview.events.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Nada en la agenda.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {overview.events.slice(0, 5).map((e) => {
                const d = eventDate(e.starts_at);
                const occupied = e.taken + e.signups;
                return (
                  <div key={e.id} className="zone-row">
                    <span style={{ fontSize: '0.88rem' }}>
                      <strong>{e.title}</strong>
                      <small style={{ color: 'var(--muted-2)', display: 'block', fontSize: '0.76rem' }}>
                        {d.dow} {d.day} {d.month} · {d.time}
                      </small>
                    </span>
                    <span style={{ fontSize: '0.82rem', color: 'var(--gold)' }}>
                      {e.capacity > 0 ? `${occupied}/${e.capacity}` : `${e.signups} apuntados`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <button className="mini-btn" style={{ justifySelf: 'start' }} onClick={() => onGo('eventos')}>
            Gestionar eventos
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------- actividad */}
      {overview && overview.activity.length > 0 && (
        <div className="card panel">
          <h3>Últimos movimientos</h3>
          <div className="timeline">
            {overview.activity.map((a) => (
              <div key={a.id} className="timeline__row">
                <span className="timeline__when">{stamp(a.at)}</span>
                <span className="timeline__what">{ACTION_LABEL[a.action] ?? a.action}</span>
                <span className="timeline__who">{a.actor}</span>
              </div>
            ))}
          </div>
          <button className="mini-btn" style={{ justifySelf: 'start' }} onClick={() => onGo('actividad')}>
            Ver el registro completo
          </button>
        </div>
      )}
    </div>
  );
}
