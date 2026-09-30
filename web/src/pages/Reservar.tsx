import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { DAY_NAMES, ZONE_LABEL } from '../lib/format';
import { IconArrow, IconClock, IconMapPin, IconUsers } from '../components/Icons';
import type { AppState } from '../lib/types';

const ACTIVITIES = ['Magic', 'Commander', 'Juego de mesa', 'Rol', 'Solo café', 'Estudiar / trabajar'];

export function Reservar({ state }: { state: AppState }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { settings } = state;

  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const maxDate = new Date(today.getTime() + 60 * 86400_000);

  const [form, setForm] = useState({
    date: iso(today),
    time: '19:00',
    people: 4,
    zone: 'juego',
    activity: 'Commander',
    note: '',
    phone: user?.phone ?? ''
  });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  /* Horario del día elegido, para avisar antes de mandar nada */
  const dayInfo = useMemo(() => {
    const picked = new Date(`${form.date}T12:00`);
    if (Number.isNaN(picked.getTime())) return null;
    const index = (picked.getDay() + 6) % 7;
    return { index, hours: settings.hours?.[index], name: DAY_NAMES[index] };
  }, [form.date, settings.hours]);

  const closedThatDay = dayInfo?.hours?.closed;

  if (!user) {
    return (
      <main className="account">
        <div className="shell">
          <div className="card cta-band">
            <span className="eyebrow">Reservar mesa</span>
            <h1 className="section-title">Entra en tu cuenta para reservar</h1>
            <p className="lead" style={{ textAlign: 'center' }}>
              Así sabemos a quién guardamos la mesa y puedes ver, cambiar o cancelar tus reservas cuando quieras.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link to="/entrar" state={{ from: '/reservar' }} className="btn btn--primary">
                Entrar <IconArrow size={16} />
              </Link>
              <Link to="/registro" className="btn btn--ghost">Crear cuenta</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (settings.reservations_open === false) {
    return (
      <main className="account">
        <div className="shell">
          <div className="card cta-band">
            <h1 className="section-title">Ahora mismo no cogemos reservas por la web</h1>
            <p className="lead" style={{ textAlign: 'center' }}>
              Pásate sin más o escríbenos por Instagram y lo vemos.
            </p>
            <Link to="/mesas" className="btn btn--primary">Ver mesas libres <IconArrow size={16} /></Link>
          </div>
        </div>
      </main>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.reservations.create(form);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido enviar la reserva.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <main className="account">
        <div className="shell">
          <div className="card cta-band">
            <span className="eyebrow">Recibida</span>
            <h1 className="section-title">Te guardamos la petición</h1>
            <p className="lead" style={{ textAlign: 'center' }}>
              La confirmamos en cuanto la veamos en la barra. Lo tendrás en «Mis reservas» y, si nos dejaste teléfono,
              te avisamos.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn btn--primary" onClick={() => navigate('/cuenta')}>Ver mis reservas</button>
              <button className="btn btn--ghost" onClick={() => setDone(false)}>Reservar otra</button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="account">
      <div className="shell" style={{ maxWidth: 780 }}>
        <div className="section-head">
          <span className="eyebrow">Reservar mesa</span>
          <h1 className="section-title">Dinos cuándo vienes</h1>
          <p className="lead">
            No cobramos nada por reservar. Si al final no puedes venir, cancélala desde tu cuenta y se la dejamos a otro.
          </p>
        </div>

        <form className="card panel" onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label>Día</label>
              <input
                className="input"
                type="date"
                min={iso(today)}
                max={iso(maxDate)}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
              {dayInfo && (
                <small style={{ color: closedThatDay ? 'var(--busy)' : 'var(--muted-2)', fontSize: '0.78rem' }}>
                  {closedThatDay
                    ? `Los ${dayInfo.name} cerramos.`
                    : `Los ${dayInfo.name} abrimos de ${dayInfo.hours?.open} a ${dayInfo.hours?.close}.`}
                </small>
              )}
            </div>

            <div className="field">
              <label>Hora</label>
              <input className="input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </div>

            <div className="field">
              <label>Cuántos sois</label>
              <input
                className="input"
                type="number"
                min={1}
                max={settings.reservation_max_people || 8}
                value={form.people}
                onChange={(e) => setForm({ ...form, people: Number(e.target.value) })}
              />
            </div>

            <div className="field">
              <label>Zona preferida</label>
              <select className="select" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })}>
                {(['juego', 'torneo', 'cafeteria'] as const).map((z) => (
                  <option key={z} value={z}>{ZONE_LABEL[z]}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>A qué venís</label>
              <select className="select" value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })}>
                {ACTIVITIES.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Teléfono de contacto</label>
              <input className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>

          <div className="field">
            <label>Algo que debamos saber</label>
            <textarea
              className="textarea"
              value={form.note}
              placeholder="Venimos con un niño, necesitamos enchufe, somos cuatro pero igual llega un quinto…"
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>

          <button className="btn btn--primary" disabled={loading || closedThatDay}>
            {loading ? 'Enviando…' : 'Pedir la mesa'} {!loading && <IconArrow size={16} />}
          </button>

          {error && <p className="error-msg">{error}</p>}

          <div className="hero__facts" style={{ marginTop: 4 }}>
            <span className="fact"><IconMapPin size={15} /> {settings.address}</span>
            <span className="fact"><IconUsers size={15} /> Hasta {settings.reservation_max_people || 8} personas</span>
            <span className="fact"><IconClock size={15} /> Te confirmamos desde la barra</span>
          </div>
        </form>
      </div>
    </main>
  );
}
