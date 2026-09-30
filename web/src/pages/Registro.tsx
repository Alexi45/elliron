import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { passwordScore, SCORE_LABEL, useAuth } from '../lib/auth';
import { IconArrow, Logo } from '../components/Icons';

export function Registro() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', repeat: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const score = useMemo(() => passwordScore(form.password), [form.password]);
  const mismatch = form.repeat.length > 0 && form.repeat !== form.password;
  const ready = form.name.trim().length >= 2 && form.email.includes('@') && form.password.length >= 10 && !mismatch;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password, phone: form.phone.trim() });
      navigate('/cuenta', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No hemos podido crear la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="card login-card login-card--wide" onSubmit={submit}>
        <div style={{ display: 'grid', placeItems: 'center', gap: 6 }}>
          <Logo size={58} />
        </div>
        <h1>Únete a El Lirón</h1>
        <p>Reserva mesa, apúntate a los torneos y entérate antes que nadie de lo que montamos.</p>

        <div style={{ display: 'grid', gap: 14 }}>
          <div className="field">
            <label htmlFor="name">Cómo te llamas</label>
            <input
              id="name"
              className="input"
              autoComplete="name"
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Tu nombre"
            />
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="email">Correo</label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="tucorreo@ejemplo.com"
              />
            </div>
            <div className="field">
              <label htmlFor="phone">Teléfono (opcional)</label>
              <input
                id="phone"
                className="input"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Por si hay que avisarte de una reserva"
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Mínimo 10 caracteres"
            />
            {form.password && (
              <div className="strength">
                <div className="strength__bars">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={i < score ? `is-on lvl-${score}` : ''} />
                  ))}
                </div>
                <small>{SCORE_LABEL[score]}</small>
              </div>
            )}
            <small style={{ color: 'var(--muted-2)', fontSize: '0.76rem' }}>
              Cuanto más larga, mejor. Tres palabras que recuerdes valen más que un lío de símbolos.
            </small>
          </div>

          <div className="field">
            <label htmlFor="repeat">Repite la contraseña</label>
            <input
              id="repeat"
              className="input"
              type="password"
              autoComplete="new-password"
              value={form.repeat}
              onChange={(e) => setForm({ ...form, repeat: e.target.value })}
            />
            {mismatch && <small style={{ color: 'var(--busy)' }}>Las dos contraseñas no coinciden.</small>}
          </div>
        </div>

        <button className="btn btn--primary btn--block" style={{ marginTop: 20 }} disabled={loading || !ready}>
          {loading ? 'Creando la cuenta…' : 'Crear mi cuenta'} {!loading && <IconArrow size={16} />}
        </button>

        {error && <p className="error-msg">{error}</p>}

        <p style={{ marginTop: 20, fontSize: '0.88rem', color: 'var(--muted)' }}>
          ¿Ya tienes cuenta? <Link to="/entrar" className="link-gold">Entra aquí</Link>
        </p>
        <p style={{ marginTop: 8, fontSize: '0.74rem', color: 'var(--muted-2)' }}>
          Solo guardamos lo necesario para atenderte: nombre, correo y, si quieres, un teléfono.
        </p>
      </form>
    </div>
  );
}
