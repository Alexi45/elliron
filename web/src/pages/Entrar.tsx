import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { IconArrow, IconLock, Logo } from '../components/Icons';
import type { AppState } from '../lib/types';

export function Entrar({ state }: { state?: AppState | null }) {
  const { login, finishTwoFactor } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const registroAbierto = state?.settings.registration_open !== false;
  const soloCatalogo = state?.settings.site_mode === 'catalogo';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const pending = await login(form.email, form.password);
      if (pending) {
        setChallenge(pending.challenge);
        return;
      }
      navigate(from || '/cuenta', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No hemos podido entrar.');
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge) return;
    setLoading(true);
    setError(null);
    try {
      await finishTwoFactor(challenge, code);
      navigate(from || '/cuenta', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ese código no vale.');
    } finally {
      setLoading(false);
    }
  };

  if (challenge) {
    return (
      <div className="login-wrap">
        <form className="card login-card" onSubmit={submitCode}>
          <div style={{ display: 'grid', placeItems: 'center', gap: 6 }}>
            <Logo size={58} />
            <span className="eyebrow" style={{ marginTop: 10 }}>
              <IconLock size={14} /> Verificación en dos pasos
            </span>
          </div>
          <h1>Tu código</h1>
          <p>Abre la app de autenticación y escribe los seis dígitos. Si no la tienes a mano, sirve un código de respaldo.</p>

          <div className="field">
            <label htmlFor="code">Código</label>
            <input
              id="code"
              className="input input--code"
              inputMode="text"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
            />
          </div>

          <button className="btn btn--primary btn--block" style={{ marginTop: 18 }} disabled={loading || code.length < 6}>
            {loading ? 'Comprobando…' : 'Entrar'}
          </button>

          {error && <p className="error-msg">{error}</p>}

          <p style={{ marginTop: 20, fontSize: '0.82rem', color: 'var(--muted-2)' }}>
            <button
              type="button"
              className="link-gold"
              style={{ background: 'none', border: 0, cursor: 'pointer', font: 'inherit' }}
              onClick={() => {
                setChallenge(null);
                setCode('');
                setError(null);
              }}
            >
              ← Volver
            </button>
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <div style={{ display: 'grid', placeItems: 'center', gap: 6 }}>
          <Logo size={62} />
          <span className="eyebrow" style={{ marginTop: 10 }}>
            <IconLock size={14} /> Tu cuenta
          </span>
        </div>
        <h1>Entra en El Lirón</h1>
        <p>
          {soloCatalogo
            ? 'Zona del equipo de la tienda. Desde aquí se gestiona lo que ve el público.'
            : 'Para reservar mesa, apuntarte a los torneos y llevar el control de tus partidas.'}
        </p>

        <div style={{ display: 'grid', gap: 14 }}>
          <div className="field">
            <label htmlFor="email">Correo</label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              autoFocus
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="tucorreo@ejemplo.com"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••••"
            />
          </div>
        </div>

        <button className="btn btn--primary btn--block" style={{ marginTop: 20 }} disabled={loading || !form.email || !form.password}>
          {loading ? 'Entrando…' : 'Entrar'} {!loading && <IconArrow size={16} />}
        </button>

        {error && <p className="error-msg">{error}</p>}

        {registroAbierto && (
          <p style={{ marginTop: 22, fontSize: '0.88rem', color: 'var(--muted)' }}>
            ¿Todavía no tienes cuenta? <Link to="/registro" className="link-gold">Créala en un minuto</Link>
          </p>
        )}
        <p style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--muted-2)' }}>
          <Link to="/">← Volver a la web</Link>
        </p>
      </form>
    </div>
  );
}
