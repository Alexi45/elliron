import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { passwordScore, SCORE_LABEL } from '../../lib/auth';
import { ROLE_LABEL, stamp } from '../../lib/format';
import type { AdminUser } from '../../lib/types';
import type { Runner } from './AdminShell';

export function UsuariosAdmin({ run }: { run: Runner }) {
  const { user: me } = useAuth();
  const [rows, setRows] = useState<AdminUser[] | null>(null);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setRows(await api.admin.users.list(q));
  }, [q]);

  useEffect(() => {
    const id = setTimeout(() => load().catch(() => setRows([])), 220);
    return () => clearTimeout(id);
  }, [load]);

  const act = (fn: () => Promise<unknown>, msg: string) => run(fn, msg).then(load);

  return (
    <>
      <div className="admin-row" style={{ marginBottom: 18, gap: 10 }}>
        <div className="field" style={{ maxWidth: 320, flex: 1 }}>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o correo…" />
        </div>
        <button className="btn btn--primary btn--sm" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancelar' : '+ Dar de alta al equipo'}
        </button>
      </div>

      {adding && <NuevoUsuario onDone={() => { setAdding(false); load(); }} run={run} />}

      {!rows ? (
        <div className="skeleton" />
      ) : rows.length === 0 ? (
        <div className="empty">Nadie por aquí.</div>
      ) : (
        <div className="table-wrap card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Rol</th>
                <th className="hide-sm">Actividad</th>
                <th className="hide-sm">Alta</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className={u.status === 'bloqueado' ? 'is-blocked' : ''}>
                  <td>
                    <strong>{u.name}</strong>
                    {me?.id === u.id && <span className="tag" style={{ marginLeft: 8 }}>tú</span>}
                    {u.locked && <span className="tag" style={{ marginLeft: 8, color: 'var(--busy)' }}>bloqueado por intentos</span>}
                    <small style={{ display: 'block', color: 'var(--muted-2)' }}>{u.email}{u.phone ? ` · ${u.phone}` : ''}</small>
                  </td>
                  <td>
                    <select
                      className="select select--mini"
                      value={u.role}
                      disabled={me?.id === u.id}
                      onChange={(e) => act(() => api.admin.users.update(u.id, { role: e.target.value }), 'Rol actualizado')}
                    >
                      {(['user', 'staff', 'admin'] as const).map((r) => (
                        <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="hide-sm">
                    <small>{u.reservations} reservas · {u.signups} torneos</small>
                    <small style={{ display: 'block', color: 'var(--muted-2)' }}>
                      {u.lastLoginAt ? `última vez ${stamp(u.lastLoginAt)}` : 'nunca ha entrado'}
                    </small>
                  </td>
                  <td className="hide-sm"><small>{stamp(u.createdAt)}</small></td>
                  <td>
                    <div className="row-actions">
                      {u.locked && (
                        <button className="mini-btn" onClick={() => act(() => api.admin.users.unlock(u.id), 'Cuenta desbloqueada')}>
                          Desbloquear
                        </button>
                      )}
                      {me?.id !== u.id && (
                        <>
                          <button
                            className="mini-btn"
                            onClick={() =>
                              act(
                                () => api.admin.users.update(u.id, { status: u.status === 'activo' ? 'bloqueado' : 'activo' }),
                                u.status === 'activo' ? 'Cuenta suspendida' : 'Cuenta reactivada'
                              )
                            }
                          >
                            {u.status === 'activo' ? 'Suspender' : 'Reactivar'}
                          </button>
                          <button className="mini-btn" onClick={() => act(() => api.admin.users.closeSessions(u.id), 'Sesiones cerradas')}>
                            Cerrar sesiones
                          </button>
                          <button
                            className="mini-btn mini-btn--danger"
                            onClick={() => {
                              if (confirm(`¿Borrar la cuenta de ${u.name}? No se puede deshacer.`)) {
                                act(() => api.admin.users.remove(u.id), 'Cuenta borrada');
                              }
                            }}
                          >
                            Borrar
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function NuevoUsuario({ onDone, run }: { onDone: () => void; run: Runner }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff' });
  const score = passwordScore(form.password);

  return (
    <div className="card panel" style={{ marginBottom: 18 }}>
      <h3>Cuenta para alguien del equipo</h3>
      <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
        El «equipo» lleva mesas, reservas, eventos y carta. «Administración» además gestiona usuarios, ajustes y el registro.
      </p>
      <div className="form-grid">
        <div className="field">
          <label>Nombre</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label>Correo</label>
          <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="field">
          <label>Rol</label>
          <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="staff">Equipo</option>
            <option value="admin">Administración</option>
            <option value="user">Cliente</option>
          </select>
        </div>
        <div className="field">
          <label>Contraseña inicial</label>
          <input
            className="input"
            type="text"
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
        </div>
      </div>
      <button
        className="btn btn--primary btn--sm"
        disabled={!form.name || !form.email || form.password.length < 10}
        onClick={() => run(() => api.admin.users.create(form), 'Cuenta creada').then(onDone)}
      >
        Crear cuenta
      </button>
    </div>
  );
}
