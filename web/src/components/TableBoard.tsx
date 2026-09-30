import { useEffect, useMemo, useState } from 'react';
import type { AppState, Zone } from '../lib/types';
import { agoLabel, sinceLabel, STATUS_LABEL, ZONE_LABEL } from '../lib/format';
import { IconRefresh } from './Icons';

/** Re-renderiza cada X ms para que los "hace 3 min" no se queden congelados */
function useTick(ms: number) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

type Filter = 'todas' | Zone;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'juego', label: 'Sala de juego' },
  { key: 'torneo', label: 'Zona de torneos' },
  { key: 'cafeteria', label: 'Cafetería' }
];

interface Props {
  state: AppState;
  live: boolean;
  lastUpdate: Date | null;
  onRefresh: () => void;
  showStats?: boolean;
}

export function TableBoard({ state, live, lastUpdate, onRefresh, showStats = true }: Props) {
  const [filter, setFilter] = useState<Filter>('todas');
  const [onlyFree, setOnlyFree] = useState(false);
  useTick(10000);

  const tables = useMemo(() => {
    return state.tables.filter((t) => {
      if (filter !== 'todas' && t.zone !== filter) return false;
      if (onlyFree && t.status !== 'libre') return false;
      return true;
    });
  }, [state.tables, filter, onlyFree]);

  const { summary } = state;
  const occupancy = summary.total ? Math.round(((summary.total - summary.free) / summary.total) * 100) : 0;

  return (
    <div>
      {showStats && (
        <div className="stats">
          <div className="card stat stat--free">
            <div className="stat__num">{summary.free}</div>
            <div className="stat__label">mesas libres</div>
          </div>
          <div className="card stat stat--seats">
            <div className="stat__num">{summary.freeSeats}</div>
            <div className="stat__label">sitios para sentarse</div>
          </div>
          <div className="card stat stat--busy">
            <div className="stat__num">{summary.occupied}</div>
            <div className="stat__label">jugando ahora</div>
          </div>
          <div className="card stat stat--res">
            <div className="stat__num">{occupancy}%</div>
            <div className="stat__label">de la sala ocupada</div>
          </div>
        </div>
      )}

      <div className="board__head">
        <div className="filters">
          {FILTERS.map((f) => (
            <button key={f.key} className={`chip ${filter === f.key ? 'is-active' : ''}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
          <button className={`chip ${onlyFree ? 'is-active' : ''}`} onClick={() => setOnlyFree((v) => !v)}>
            Solo libres
          </button>
        </div>

        <div className="board__note" style={{ marginTop: 0 }}>
          <span className={`dot ${live ? 'dot--live' : 'dot--closed'}`} />
          {live ? 'En directo' : 'Actualizando cada poco'} · {agoLabel(lastUpdate)}
          <button className="mini-btn" onClick={onRefresh} style={{ marginLeft: 4 }}>
            <IconRefresh /> Actualizar
          </button>
        </div>
      </div>

      {tables.length === 0 ? (
        <div className="empty">
          {onlyFree ? 'Ahora mismo no queda ninguna mesa libre en esta zona. Pásate igualmente: se liberan cada rato.' : 'No hay mesas en esta zona.'}
        </div>
      ) : (
        <div className="tables-grid">
          {tables.map((t) => (
            <article key={t.id} className={`card table-card table-card--${t.status}`}>
              <div className="table-card__top">
                <div>
                  <h3 className="table-card__name">{t.name}</h3>
                  <div className="table-card__zone">{ZONE_LABEL[t.zone]}</div>
                </div>
                <span className="badge">{STATUS_LABEL[t.status]}</span>
              </div>

              <div className="seats" aria-label={`${t.seats} plazas`}>
                {Array.from({ length: Math.min(t.seats, 8) }).map((_, i) => (
                  <span key={i} className="seat" />
                ))}
                <span className="seats__label">{t.seats} plazas</span>
              </div>

              <p className="table-card__note">{t.game ? `Jugando a ${t.game}` : t.note || (t.status === 'libre' ? 'Lista para vosotros' : '')}</p>

              {t.status === 'ocupada' && t.occupied_since && <div className="table-card__meta">Ocupada {sinceLabel(t.occupied_since)}</div>}
              {t.status === 'reservada' && t.note && t.game && <div className="table-card__meta">{t.note}</div>}
            </article>
          ))}
        </div>
      )}

      <p className="board__note">
        El estado lo actualiza el equipo desde la barra. Si ves algo raro, pregúntanos por Instagram y lo arreglamos al momento.
      </p>
    </div>
  );
}
