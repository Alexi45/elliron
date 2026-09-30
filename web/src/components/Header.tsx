import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from './Icons';
import { useAuth } from '../lib/auth';
import type { AppState } from '../lib/types';

const LINKS_COMPLETO = [
  { href: '#mesas', label: 'Mesas en vivo' },
  { href: '#torneos', label: 'Torneos' },
  { href: '#carta', label: 'La carta' },
  { href: '#visitanos', label: 'Visítanos' }
];

/* Con la tienda de obras solo enseñamos el escaparate y cómo llegar */
const LINKS_CATALOGO = [
  { href: '#catalogo', label: 'Productos' },
  { href: '#visitanos', label: 'Dónde estamos' }
];

export function Header({ state }: { state: AppState | null }) {
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { user, isStaff, logout } = useAuth();
  const onHome = pathname === '/';

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const href = (hash: string) => (onHome ? hash : `/${hash}`);
  const isOpenNow = state?.store.open;
  const firstName = user?.name.split(' ')[0];
  const catalogo = state?.settings.site_mode === 'catalogo';
  const LINKS = catalogo ? LINKS_CATALOGO : LINKS_COMPLETO;

  return (
    <>
      <header className={`header ${stuck ? 'is-stuck' : ''}`}>
        <div className="shell header__inner">
          <Link to="/" className="brand" aria-label="El Lirón, inicio">
            <Logo size={38} />
            <span>
              <span className="brand__name">EL LIRÓN</span>
              <span className="brand__sub">Montequinto</span>
            </span>
          </Link>

          <nav className="nav">
            {LINKS.map((l) => (
              <a key={l.href} href={href(l.href)}>
                {l.label}
              </a>
            ))}
            {!catalogo && <Link to="/reservar">Reservar</Link>}
          </nav>

          <div className="header__actions">
            {state && !catalogo && (
              <span className="pill hide-md" title={isOpenNow ? 'La tienda está abierta' : 'Ahora mismo cerrado'}>
                <span className={`dot ${isOpenNow ? 'dot--live' : 'dot--closed'}`} />
                {isOpenNow ? (
                  <>
                    Abierto · <strong>{state.summary.free}</strong> libres
                  </>
                ) : (
                  'Cerrado ahora'
                )}
              </span>
            )}

            {user ? (
              <Link to={isStaff ? '/admin' : '/cuenta'} className="btn btn--primary btn--sm">
                {isStaff ? 'Panel' : firstName}
              </Link>
            ) : catalogo ? (
              <a href={href('#catalogo')} className="btn btn--primary btn--sm">Ver productos</a>
            ) : (
              <>
                <Link to="/entrar" className="btn btn--ghost btn--sm hide-sm">Entrar</Link>
                <Link to="/registro" className="btn btn--primary btn--sm">Únete</Link>
              </>
            )}

            <button
              className={`burger ${open ? 'is-open' : ''}`}
              onClick={() => setOpen((v) => !v)}
              aria-label="Abrir menú"
              aria-expanded={open}
            >
              <span />
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="mobile-nav">
          {LINKS.map((l) => (
            <a key={l.href} href={href(l.href)} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          {!catalogo && (
            <>
              <Link to="/mesas" onClick={() => setOpen(false)}>Estado de la sala</Link>
              <Link to="/reservar" onClick={() => setOpen(false)}>Reservar mesa</Link>
            </>
          )}
          {user ? (
            <>
              <Link to="/cuenta" onClick={() => setOpen(false)}>Mi cuenta</Link>
              {isStaff && <Link to="/admin" onClick={() => setOpen(false)}>Panel de la tienda</Link>}
              <button
                className="mobile-nav__button"
                onClick={() => {
                  logout();
                  setOpen(false);
                }}
              >
                Cerrar sesión
              </button>
            </>
          ) : catalogo ? null : (
            <>
              <Link to="/entrar" onClick={() => setOpen(false)}>Entrar</Link>
              <Link to="/registro" onClick={() => setOpen(false)}>Crear cuenta</Link>
            </>
          )}
        </div>
      )}
    </>
  );
}
