import { Link } from 'react-router-dom';
import { TableBoard } from '../components/TableBoard';
import { todayLabel } from '../lib/format';
import { IconArrow, IconClock, IconMapPin } from '../components/Icons';
import type { AppState } from '../lib/types';

interface Props {
  state: AppState;
  live: boolean;
  lastUpdate: Date | null;
  onRefresh: () => void;
}

export function Mesas({ state, live, lastUpdate, onRefresh }: Props) {
  const { store, settings, summary } = state;

  return (
    <main style={{ paddingTop: 'calc(var(--header-h) + 42px)' }}>
      <section style={{ paddingTop: 12 }}>
        <div className="shell">
          <div className="section-head">
            <span className="eyebrow">Estado de la sala · en directo</span>
            <h1 className="section-title">
              {store.open ? (
                summary.free > 0 ? (
                  <>
                    Hay <span className="gold-text">{summary.free} mesas libres</span> ahora mismo
                  </>
                ) : (
                  <>La sala está <span className="gold-text">a tope</span> ahora mismo</>
                )
              ) : (
                <>Ahora mismo <span className="gold-text">estamos cerrados</span></>
              )}
            </h1>
            <p className="lead">
              {store.open
                ? `Abierto hasta las ${store.closesAt ?? '—'}. Esto es lo que hay en la tienda en este momento.`
                : store.nextOpen
                  ? `Volvemos a abrir ${store.nextOpen.day} a las ${store.nextOpen.time}. Así quedó la sala.`
                  : 'Consulta nuestro Instagram para saber cuándo volvemos a abrir.'}
            </p>

            <div className="hero__facts" style={{ marginTop: 6 }}>
              <span className="fact"><IconMapPin size={16} /> {settings.address}</span>
              <span className="fact"><IconClock size={16} /> {todayLabel(store)}</span>
            </div>
          </div>

          <TableBoard state={state} live={live} lastUpdate={lastUpdate} onRefresh={onRefresh} />

          <div style={{ marginTop: 34, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/" className="btn btn--ghost">Volver a la web</Link>
            <a href={settings.maps_url} target="_blank" rel="noreferrer noopener" className="btn btn--primary">
              Cómo llegar <IconArrow />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
