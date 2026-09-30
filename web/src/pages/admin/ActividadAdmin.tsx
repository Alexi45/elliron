import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { ACTION_LABEL, stamp } from '../../lib/format';
import type { AuditEntry } from '../../lib/types';

const SECURITY = new Set([
  'login-fallido',
  'login-bloqueado',
  'sesion-reutilizada',
  'cambio-pw-fallido',
  'usuario-borrado',
  'usuario-actualizado'
]);

export function ActividadAdmin() {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [onlySecurity, setOnlySecurity] = useState(false);

  const load = () => api.admin.audit().then(setRows).catch(() => setRows([]));
  useEffect(() => {
    load();
  }, []);

  const visible = (rows ?? []).filter((r) => !onlySecurity || SECURITY.has(r.action));

  return (
    <>
      <div className="admin-row" style={{ marginBottom: 18, gap: 10 }}>
        <button className={`chip ${onlySecurity ? '' : 'is-active'}`} onClick={() => setOnlySecurity(false)}>Todo</button>
        <button className={`chip ${onlySecurity ? 'is-active' : ''}`} onClick={() => setOnlySecurity(true)}>Solo seguridad</button>
        <button className="mini-btn" style={{ marginLeft: 'auto' }} onClick={load}>Actualizar</button>
      </div>

      {!rows ? (
        <div className="skeleton" />
      ) : visible.length === 0 ? (
        <div className="empty">Nada registrado todavía.</div>
      ) : (
        <div className="table-wrap card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cuándo</th>
                <th>Qué</th>
                <th>Quién</th>
                <th className="hide-sm">Detalle</th>
                <th className="hide-sm">IP</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className={SECURITY.has(r.action) ? 'is-security' : ''}>
                  <td><small>{stamp(r.at)}</small></td>
                  <td>{ACTION_LABEL[r.action] ?? r.action}</td>
                  <td><small>{r.actor}</small></td>
                  <td className="hide-sm"><small style={{ color: 'var(--muted-2)' }}>{r.detail}</small></td>
                  <td className="hide-sm"><small style={{ color: 'var(--muted-2)' }}>{r.ip}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="board__note">
        Se guardan los accesos, los cambios del equipo y los intentos fallidos. Útil para saber quién tocó qué y para detectar
        a alguien probando contraseñas.
      </p>
    </>
  );
}
