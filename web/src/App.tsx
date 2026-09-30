import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { Mesas } from './pages/Mesas';
import { Entrar } from './pages/Entrar';
import { Registro } from './pages/Registro';
import { Cuenta } from './pages/Cuenta';
import { Reservar } from './pages/Reservar';
import { AdminShell } from './pages/admin/AdminShell';
import { useLiveState } from './lib/useLiveState';
import { useAuth } from './lib/auth';
import type { AppState } from './lib/types';

export default function App() {
  const { state, error, live, lastUpdate, refresh } = useLiveState();

  return (
    <>
      <div className="backdrop" />
      <div className="orb orb--1" />
      <div className="orb orb--2" />
      <div className="orb orb--3" />

      <Routes>
        <Route path="/admin" element={<AdminShell state={state} live={live} onChanged={refresh} />} />
        <Route path="/entrar" element={<Entrar />} />
        <Route path="/registro" element={<RegistroSiAbierto state={state} />} />
        <Route
          path="*"
          element={
            <PublicLayout state={state} error={error} live={live} lastUpdate={lastUpdate} refresh={refresh} />
          }
        />
      </Routes>
    </>
  );
}

interface LayoutProps {
  state: AppState | null;
  error: string | null;
  live: boolean;
  lastUpdate: Date | null;
  refresh: () => void;
}

function PublicLayout({ state, error, live, lastUpdate, refresh }: LayoutProps) {
  const catalogo = state?.settings.site_mode === 'catalogo';

  return (
    <>
      <Header state={state} />
      {!state ? (
        <main className="shell" style={{ paddingTop: 'calc(var(--header-h) + 60px)', minHeight: '70vh' }}>
          {error ? (
            <div className="empty" style={{ marginTop: 40 }}>
              {error}
              <div style={{ marginTop: 16 }}>
                <button className="btn btn--ghost btn--sm" onClick={refresh}>Reintentar</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16, marginTop: 40 }}>
              <div className="skeleton" style={{ height: 220 }} />
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          )}
        </main>
      ) : (
        <Routes>
          <Route path="/" element={<Home state={state} live={live} lastUpdate={lastUpdate} onRefresh={refresh} />} />
          {/* Con la tienda de obras estas páginas no se enseñan, pero siguen en el código */}
          <Route
            path="/mesas"
            element={
              catalogo ? <Navigate to="/" replace /> : <Mesas state={state} live={live} lastUpdate={lastUpdate} onRefresh={refresh} />
            }
          />
          <Route path="/reservar" element={catalogo ? <Navigate to="/" replace /> : <Reservar state={state} />} />
          <Route
            path="/cuenta"
            element={
              <RequireUser>
                <Cuenta />
              </RequireUser>
            }
          />
          <Route path="*" element={<Home state={state} live={live} lastUpdate={lastUpdate} onRefresh={refresh} />} />
        </Routes>
      )}
      <Footer settings={state?.settings ?? null} />
    </>
  );
}

/** Con el registro cerrado, esa página manda a la de entrar */
function RegistroSiAbierto({ state }: { state: AppState | null }) {
  if (state && state.settings.registration_open === false) return <Navigate to="/entrar" replace />;
  return <Registro />;
}

function RequireUser({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="shell" style={{ paddingTop: 'calc(var(--header-h) + 60px)', minHeight: '60vh' }}>
        <div className="skeleton" style={{ height: 240 }} />
      </main>
    );
  }
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
