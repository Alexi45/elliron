import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, tokenStore } from '../lib/api';
import { passwordScore, SCORE_LABEL, useAuth } from '../lib/auth';
import { eventDate, RESERVATION_LABEL, ZONE_LABEL } from '../lib/format';
import { IconArrow, IconCalendar, IconClock, IconLock, IconShield, IconTicket, IconUsers } from '../components/Icons';
import type { LironEvent, Reservation, Session } from '../lib/types';

type Tab = 'reservas' | 'torneos' | 'perfil';

export function Cuenta() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('reservas');
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [events, setEvents] = useState<LironEvent[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    const [r, e] = await Promise.all([api.reservations.mine(), api.signups.mine()]);
    setReservations(r);
    setEvents(e.events);
  };

  useEffect(() => {
    load().catch(() => setToast('No hemos podido cargar tus datos.'));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(id);
  }, [toast]);

  if (!user) return null;

  const cancel = async (id: number) => {
    if (!confirm('¿Cancelamos esa reserva?')) return;
    await api.reservations.cancel(id);
    await load();
    await refreshUser();
    setToast('Reserva cancelada');
  };

  const leave = async (id: number) => {
    await api.signups.leave(id);
    await load();
    setToast('Te has borrado del evento');
  };

  return (
    <main className="account">
      <div className="shell">
        <div className="account__head">
          <div>
            <span className="eyebrow">Tu cuenta</span>
            <h1 className="section-title" style={{ margin: '12px 0 6px' }}>
              Hola, <span className="gold-text">{user.name.split(' ')[0]}</span>
            </h1>
            <p className="lead">{user.email}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link to="/reservar" className="btn btn--primary btn--sm">Reservar mesa <IconArrow size={15} /></Link>
            <button
              className="btn btn--ghost btn--sm"
              onClick={async () => {
                await logout();
                navigate('/');
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        {user.standing === 'vetado' && (
          <div className="notice-band notice-band--warn" style={{ marginBottom: 20 }}>
            <span>
              <strong>Ahora mismo no puedes reservar ni apuntarte a eventos</strong>
              {user.standingUntil ? ` hasta el ${user.standingUntil}` : ''}.
              {user.standingNote ? ` ${user.standingNote}.` : ''} Pásate por la tienda y lo hablamos.
            </span>
          </div>
        )}
        {user.standing !== 'vetado' && (user.strikes ?? 0) > 0 && (
          <div className="notice-band" style={{ marginBottom: 20 }}>
            <span>
              Tienes <strong>{user.strikes}</strong> {user.strikes === 1 ? 'falta apuntada' : 'faltas apuntadas'} por no venir a
              algo que habías reservado o donde te habías apuntado. Si no puedes venir, cancélalo desde aquí y ya está.
            </span>
          </div>
        )}

        <div className="admin__tabs">
          {([
            ['reservas', 'Mis reservas'],
            ['torneos', 'Mis torneos'],
            ['perfil', 'Perfil y seguridad']
          ] as [Tab, string][]).map(([key, label]) => (
            <button key={key} className={`chip ${tab === key ? 'is-active' : ''}`} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'reservas' && <MisReservas reservations={reservations} onCancel={cancel} />}
        {tab === 'torneos' && <MisTorneos events={events} onLeave={leave} />}
        {tab === 'perfil' && <Perfil onToast={setToast} />}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

/* ---------------------------------------------------------------- reservas */

function MisReservas({ reservations, onCancel }: { reservations: Reservation[] | null; onCancel: (id: number) => void }) {
  if (!reservations) return <div className="skeleton" />;
  if (reservations.length === 0) {
    return (
      <div className="empty">
        Todavía no has reservado ninguna mesa.
        <div style={{ marginTop: 16 }}>
          <Link to="/reservar" className="btn btn--primary btn--sm">Reservar una mesa</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-grid">
      {reservations.map((r) => {
        const d = eventDate(`${r.date}T${r.time}`);
        const cancellable = r.status === 'pendiente' || r.status === 'confirmada';
        return (
          <article key={r.id} className={`card reservation reservation--${r.status}`}>
            <div className="reservation__top">
              <div className="datebox">
                <div className="datebox__dow">{d.isToday ? 'hoy' : d.isTomorrow ? 'mañana' : d.dow}</div>
                <div className="datebox__day">{d.day}</div>
                <div className="datebox__mon">{d.month}</div>
              </div>
              <div>
                <span className="badge">{RESERVATION_LABEL[r.status]}</span>
                <div className="reservation__meta">
                  <span><IconClock size={14} /> {r.time}</span>
                  <span><IconUsers size={14} /> {r.people} personas</span>
                </div>
                <div className="reservation__meta">
                  <span>{ZONE_LABEL[r.zone]}</span>
                  {r.table_name && <span>· {r.table_name}</span>}
                </div>
              </div>
            </div>

            {r.activity && <p className="table-card__note">Para jugar a {r.activity}</p>}
            {r.reply && <p className="reservation__reply">«{r.reply}»</p>}

            {cancellable && (
              <button className="mini-btn mini-btn--danger" onClick={() => onCancel(r.id)} style={{ justifySelf: 'start' }}>
                Cancelar
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- torneos */

function MisTorneos({ events, onLeave }: { events: LironEvent[] | null; onLeave: (id: number) => void }) {
  if (!events) return <div className="skeleton" />;
  if (events.length === 0) {
    return (
      <div className="empty">
        No estás apuntado a ningún evento.
        <div style={{ marginTop: 16 }}>
          <Link to="/#torneos" className="btn btn--primary btn--sm">Ver la agenda</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-grid">
      {events.map((e) => {
        const d = eventDate(e.starts_at);
        return (
          <article key={e.id} className="card event">
            <div className="datebox">
              <div className="datebox__dow">{d.isToday ? 'hoy' : d.isTomorrow ? 'mañana' : d.dow}</div>
              <div className="datebox__day">{d.day}</div>
              <div className="datebox__mon">{d.month}</div>
            </div>
            <div className="event__body">
              <h3 className="event__title">{e.title}</h3>
              <div className="event__meta">
                <span><IconClock size={14} /> {d.time}</span>
                {e.price && <span><IconTicket size={14} /> {e.price}</span>}
              </div>
              <button className="mini-btn mini-btn--danger" style={{ marginTop: 14 }} onClick={() => onLeave(e.id)}>
                No puedo ir
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------- perfil y seguridad */

function Perfil({ onToast }: { onToast: (msg: string) => void }) {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState({ name: user?.name ?? '', phone: user?.phone ?? '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', repeat: '' });
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = () => api.auth.sessions().then((s) => setSessions(s.sessions)).catch(() => undefined);
  useEffect(() => {
    loadSessions();
  }, []);

  const score = passwordScore(pw.newPassword);
  const canChange = pw.currentPassword && pw.newPassword.length >= 10 && pw.newPassword === pw.repeat;

  const saveProfile = async () => {
    try {
      await api.auth.updateProfile(profile);
      await refreshUser();
      onToast('Datos guardados');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido guardar');
    }
  };

  const changePassword = async () => {
    setError(null);
    try {
      const res = await api.auth.changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      tokenStore.set(res.accessToken);
      setPw({ currentPassword: '', newPassword: '', repeat: '' });
      await loadSessions();
      onToast('Contraseña cambiada. Hemos cerrado el resto de sesiones.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido cambiar');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="card panel">
        <h3>Tus datos</h3>
        <div className="form-grid">
          <div className="field">
            <label>Nombre</label>
            <input className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          </div>
          <div className="field">
            <label>Teléfono</label>
            <input className="input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
          </div>
          <div className="field">
            <label>Correo</label>
            <input className="input" value={user?.email ?? ''} disabled />
          </div>
        </div>
        <button className="btn btn--primary btn--sm" onClick={saveProfile}>Guardar</button>
      </div>

      <div className="card panel">
        <h3><IconLock size={18} /> Cambiar la contraseña</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
          Al cambiarla cerramos la sesión en todos los demás dispositivos.
        </p>
        <div className="form-grid">
          <div className="field">
            <label>Contraseña actual</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={pw.currentPassword}
              onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Nueva contraseña</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={pw.newPassword}
              onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
            />
            {pw.newPassword && (
              <div className="strength">
                <div className="strength__bars">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={i < score ? `is-on lvl-${score}` : ''} />
                  ))}
                </div>
                <small>{SCORE_LABEL[score]}</small>
              </div>
            )}
          </div>
          <div className="field">
            <label>Repítela</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={pw.repeat}
              onChange={(e) => setPw({ ...pw, repeat: e.target.value })}
            />
          </div>
        </div>
        <button className="btn btn--primary btn--sm" disabled={!canChange} onClick={changePassword}>
          Cambiar contraseña
        </button>
        {error && <p className="error-msg">{error}</p>}
      </div>

      <DosPasos onToast={onToast} />

      <div className="card panel">
        <h3><IconCalendar size={18} /> Dónde tienes la sesión abierta</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          {sessions.map((s) => (
            <div key={s.id} className="zone-row">
              <span style={{ fontSize: '0.84rem' }}>{shortAgent(s.user_agent)}</span>
              <span style={{ color: 'var(--muted-2)', fontSize: '0.78rem' }}>desde {s.created_at.slice(0, 16).replace('T', ' ')}</span>
            </div>
          ))}
          {sessions.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>Solo esta.</p>}
        </div>
        <button
          className="btn btn--ghost btn--sm"
          onClick={async () => {
            const res = await api.auth.closeOtherSessions();
            tokenStore.set(res.accessToken);
            await loadSessions();
            onToast('Cerradas las demás sesiones');
          }}
        >
          Cerrar las demás sesiones
        </button>
      </div>
    </div>
  );
}

function shortAgent(agent: string) {
  if (!agent) return 'Dispositivo desconocido';
  if (/iphone|android|mobile/i.test(agent)) return 'Móvil';
  if (/ipad|tablet/i.test(agent)) return 'Tablet';
  if (/mac/i.test(agent)) return 'Ordenador (Mac)';
  if (/windows/i.test(agent)) return 'Ordenador (Windows)';
  return 'Ordenador';
}

/* ------------------------------------------------ verificación en dos pasos */

function DosPasos({ onToast }: { onToast: (msg: string) => void }) {
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState<{ enabled: boolean; backupCodesLeft: number } | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.auth.twoFactor.status().then(setStatus).catch(() => undefined);
  useEffect(() => {
    load();
  }, []);

  const start = async () => {
    setError(null);
    try {
      const data = await api.auth.twoFactor.setup();
      setSetup({ secret: data.secret, qr: data.qr });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido');
    }
  };

  const enable = async () => {
    setError(null);
    try {
      const res = await api.auth.twoFactor.enable(code);
      setCodes(res.backupCodes);
      setSetup(null);
      setCode('');
      await load();
      await refreshUser();
      onToast('Verificación en dos pasos activada');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ese código no vale');
    }
  };

  const disable = async () => {
    setError(null);
    try {
      await api.auth.twoFactor.disable(password, code);
      setPassword('');
      setCode('');
      await load();
      await refreshUser();
      onToast('Verificación desactivada');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido');
    }
  };

  return (
    <div className="card panel">
      <h3><IconShield size={18} /> Verificación en dos pasos</h3>
      <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
        Con esto, aunque alguien averigüe tu contraseña no puede entrar sin el código de tu móvil. Vale cualquier app de
        autenticación: Google Authenticator, Authy, 1Password, Aegis…
        {user?.role !== 'user' && ' Si llevas el panel de la tienda, actívala.'}
      </p>

      {status?.enabled ? (
        <>
          <p className="ok-msg">Activada · te quedan {status.backupCodesLeft} códigos de respaldo.</p>
          <div className="form-grid">
            <div className="field">
              <label>Tu contraseña</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="field">
              <label>Código de la app</label>
              <input className="input input--code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn btn--ghost btn--sm"
              disabled={code.length < 6}
              onClick={async () => {
                try {
                  const res = await api.auth.twoFactor.newBackupCodes(code);
                  setCodes(res.backupCodes);
                  setCode('');
                  await load();
                  onToast('Códigos nuevos generados');
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'No se ha podido');
                }
              }}
            >
              Generar códigos de respaldo nuevos
            </button>
            <button className="mini-btn mini-btn--danger" disabled={!password || code.length < 6} onClick={disable}>
              Desactivar
            </button>
          </div>
        </>
      ) : setup ? (
        <>
          <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
            Escanea este código con la app y escribe los seis dígitos que te dé.
          </p>
          <div className="qr" dangerouslySetInnerHTML={{ __html: setup.qr }} />
          <p style={{ fontSize: '0.78rem', color: 'var(--muted-2)' }}>
            ¿No puedes escanear? Escribe esta clave a mano: <code className="secret">{setup.secret}</code>
          </p>
          <div className="field" style={{ maxWidth: 220 }}>
            <label>Código de la app</label>
            <input className="input input--code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--primary btn--sm" disabled={code.length < 6} onClick={enable}>Activar</button>
            <button className="mini-btn" onClick={() => { setSetup(null); setCode(''); }}>Cancelar</button>
          </div>
        </>
      ) : (
        <button className="btn btn--primary btn--sm" onClick={start}>Activar la verificación</button>
      )}

      {codes && (
        <div className="backup-codes">
          <strong>Guarda estos códigos de respaldo</strong>
          <p>Sirven una sola vez cada uno, por si pierdes el móvil. No volverás a verlos.</p>
          <div className="backup-codes__grid">
            {codes.map((c) => (
              <code key={c}>{c}</code>
            ))}
          </div>
          <button className="mini-btn" onClick={() => setCodes(null)}>Ya los tengo guardados</button>
        </div>
      )}

      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}
