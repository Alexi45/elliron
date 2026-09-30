import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { ROLE_LABEL } from '../../lib/format';
import { IconArrow, Logo } from '../../components/Icons';
import type { AppState, Overview } from '../../lib/types';

import { Resumen } from './Resumen';
import { MesasAdmin } from './MesasAdmin';
import { ReservasAdmin } from './ReservasAdmin';
import { EventosAdmin } from './EventosAdmin';
import { FaltasAdmin } from './FaltasAdmin';
import { CartaAdmin } from './CartaAdmin';
import { CatalogoAdmin } from './CatalogoAdmin';
import { UsuariosAdmin } from './UsuariosAdmin';
import { AjustesAdmin } from './AjustesAdmin';
import { ActividadAdmin } from './ActividadAdmin';

export type Section =
  | 'catalogo'
  | 'resumen'
  | 'mesas'
  | 'reservas'
  | 'eventos'
  | 'faltas'
  | 'carta'
  | 'usuarios'
  | 'ajustes'
  | 'actividad';

export type Runner = (fn: () => Promise<unknown>, msg: string) => Promise<void>;

const SECTIONS: { key: Section; label: string; icon: string; adminOnly?: boolean; soloCatalogo?: boolean; soloCompleto?: boolean }[] = [
  { key: 'catalogo', label: 'Catálogo', icon: '▤' },
  { key: 'resumen', label: 'Resumen', icon: '◉' },
  { key: 'mesas', soloCompleto: true, label: 'Mesas', icon: '▦' },
  { key: 'reservas', soloCompleto: true, label: 'Reservas', icon: '✦' },
  { key: 'eventos', soloCompleto: true, label: 'Eventos', icon: '♞' },
  { key: 'faltas', soloCompleto: true, label: 'Faltas', icon: '⚑' },
  { key: 'carta', soloCompleto: true, label: 'Carta', icon: '☕' },
  { key: 'usuarios', label: 'Usuarios', icon: '☺', adminOnly: true },
  { key: 'ajustes', label: 'Ajustes', icon: '⚙', adminOnly: true },
  { key: 'actividad', label: 'Actividad', icon: '⟲', adminOnly: true }
];

interface Props {
  state: AppState | null;
  live: boolean;
  onChanged: () => void;
}

export function AdminShell({ state, live, onChanged }: Props) {
  const { user, loading, isStaff, isAdmin, logout } = useAuth();
  /* Con la tienda de obras el panel enseña el catálogo y poco más;
     al volver al modo completo reaparece todo. */
  const catalogo = state?.settings.site_mode === 'catalogo';
  const location = useLocation();
  const [section, setSection] = useState<Section>('catalogo');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  const loadOverview = useCallback(() => {
    if (!isStaff) return;
    api.admin
      .overview()
      .then(setOverview)
      .catch(() => undefined);
  }, [isStaff]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview, state?.updatedAt]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(id);
  }, [toast]);

  const run = useCallback<Runner>(
    async (fn, msg) => {
      try {
        await fn();
        onChanged();
        loadOverview();
        setToast(msg);
      } catch (err) {
        setToast(err instanceof Error ? err.message : 'Ha fallado algo');
      }
    },
    [onChanged, loadOverview]
  );

  if (loading) {
    return (
      <div className="shell admin">
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }

  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;

  if (!isStaff) {
    return (
      <div className="login-wrap">
        <div className="card login-card">
          <Logo size={58} />
          <h1>Esta zona es del equipo</h1>
          <p>Tu cuenta es de cliente. Si trabajas en la tienda, pide que te den acceso desde el panel.</p>
          <Link to="/cuenta" className="btn btn--primary btn--block">Ir a mi cuenta</Link>
        </div>
      </div>
    );
  }

  // Si la tienda exige dos pasos al equipo, no se entra al panel sin tenerla
  if (state?.settings.require_2fa_staff && !user.twoFactor) {
    return (
      <div className="login-wrap">
        <div className="card login-card">
          <Logo size={58} />
          <h1>Falta un paso</h1>
          <p>
            En esta tienda el panel pide verificación en dos pasos. Actívala en tu cuenta (tardas un minuto con la app del
            móvil) y vuelve aquí.
          </p>
          <Link to="/cuenta" className="btn btn--primary btn--block">Activarla ahora</Link>
          <p style={{ marginTop: 16, fontSize: '0.8rem' }}>
            <button className="mini-btn" onClick={logout}>Cerrar sesión</button>
          </p>
        </div>
      </div>
    );
  }

  const visible = SECTIONS.filter((s) => (!s.adminOnly || isAdmin) && !(catalogo && s.soloCompleto));

  return (
    <div className="dash">
      <aside className={`dash__side ${navOpen ? 'is-open' : ''}`}>
        <Link to="/" className="brand" style={{ marginBottom: 26 }}>
          <Logo size={38} />
          <span>
            <span className="brand__name">PANEL</span>
            <span className="brand__sub">El Lirón</span>
          </span>
        </Link>

        <nav className="dash__nav">
          {visible.map((s) => (
            <button
              key={s.key}
              className={`dash__link ${section === s.key ? 'is-active' : ''}`}
              onClick={() => {
                setSection(s.key);
                setNavOpen(false);
              }}
            >
              <span className="dash__icon">{s.icon}</span>
              {s.label}
              {s.key === 'reservas' && overview && overview.reservations.pending > 0 && (
                <span className="dash__badge">{overview.reservations.pending}</span>
              )}
              {s.key === 'faltas' && overview && overview.strikes.banned > 0 && (
                <span className="dash__badge dash__badge--alert">{overview.strikes.banned}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="dash__user">
          <div>
            <strong>{user.name}</strong>
            <small>{ROLE_LABEL[user.role]}</small>
          </div>
          <div className="dash__user-actions">
            <Link to="/" className="mini-btn">Ver la web</Link>
            <button className="mini-btn" onClick={logout}>Salir</button>
          </div>
        </div>
      </aside>

      <div className="dash__main">
        <header className="dash__topbar">
          <button className={`burger ${navOpen ? 'is-open' : ''}`} onClick={() => setNavOpen((v) => !v)} aria-label="Menú del panel">
            <span />
          </button>
          <h1 className="dash__title">{visible.find((s) => s.key === section)?.label}</h1>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginLeft: 'auto' }}>
            {catalogo ? (
              <span className="pill" title="La web solo enseña el catálogo">
                <span className="dot dot--closed" />
                Web informativa
              </span>
            ) : (
              <>
                <span className="pill">
                  <span className={`dot ${live ? 'dot--live' : 'dot--closed'}`} />
                  {live ? 'En directo' : 'Reconectando'}
                </span>
                {state && (
                  <span className="pill hide-sm">
                    <span className={`dot ${state.store.open ? 'dot--live' : 'dot--closed'}`} />
                    {state.store.open ? 'Tienda abierta' : 'Tienda cerrada'}
                  </span>
                )}
              </>
            )}
            <Link to="/mesas" className="btn btn--ghost btn--sm hide-sm">
              Vista pública <IconArrow size={14} />
            </Link>
          </div>
        </header>

        <div className="dash__content">
          {!state ? (
            <div className="skeleton" style={{ height: 300 }} />
          ) : (
            <>
              {section === 'catalogo' && <CatalogoAdmin products={state.products} settings={state.settings} run={run} />}
              {section === 'resumen' && <Resumen overview={overview} state={state} run={run} onGo={setSection} />}
              {section === 'mesas' && <MesasAdmin tables={state.tables} run={run} />}
              {section === 'reservas' && <ReservasAdmin tables={state.tables} run={run} />}
              {section === 'eventos' && <EventosAdmin events={state.events} run={run} />}
              {section === 'faltas' && <FaltasAdmin run={run} />}
              {section === 'carta' && <CartaAdmin menu={state.menu} run={run} />}
              {section === 'usuarios' && isAdmin && <UsuariosAdmin run={run} />}
              {section === 'ajustes' && isAdmin && <AjustesAdmin settings={state.settings} run={run} />}
              {section === 'actividad' && isAdmin && <ActividadAdmin />}
            </>
          )}
        </div>
      </div>

      {navOpen && <div className="dash__overlay" onClick={() => setNavOpen(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
