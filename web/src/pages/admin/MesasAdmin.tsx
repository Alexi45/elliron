import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { sinceLabel, STATUS_LABEL, ZONE_LABEL } from '../../lib/format';
import type { GameTable, TableStatus } from '../../lib/types';
import type { Runner } from './AdminShell';

const STATUSES: TableStatus[] = ['libre', 'ocupada', 'reservada', 'fuera'];
const ZONES = ['juego', 'torneo', 'cafeteria'] as const;

export function MesasAdmin({ tables, run }: { tables: GameTable[]; run: Runner }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', zone: 'juego', seats: 4 });

  return (
    <>
      <div className="admin-row" style={{ marginBottom: 18, gap: 10 }}>
        <button className="btn btn--primary btn--sm" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancelar' : '+ Añadir mesa'}
        </button>
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => {
            if (confirm('¿Marcar todas las mesas como libres?')) run(() => api.admin.tables.freeAll(), 'Sala vacía');
          }}
        >
          Liberar todas
        </button>
        <span className="admin-hint">Cada toque se ve al instante en la web, sin recargar.</span>
      </div>

      {adding && (
        <div className="card panel" style={{ marginBottom: 18 }}>
          <h3>Nueva mesa</h3>
          <div className="form-grid">
            <div className="field">
              <label>Nombre</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mesa 7" />
            </div>
            <div className="field">
              <label>Zona</label>
              <select className="select" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })}>
                {ZONES.map((z) => (
                  <option key={z} value={z}>{ZONE_LABEL[z]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Plazas</label>
              <input
                className="input"
                type="number"
                min={1}
                max={12}
                value={form.seats}
                onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })}
              />
            </div>
          </div>
          <button
            className="btn btn--primary btn--sm"
            disabled={!form.name.trim()}
            onClick={() =>
              run(() => api.admin.tables.create(form), 'Mesa añadida').then(() => {
                setForm({ name: '', zone: 'juego', seats: 4 });
                setAdding(false);
              })
            }
          >
            Guardar mesa
          </button>
        </div>
      )}

      <div className="admin-grid">
        {tables.map((t) => (
          <TableEditor key={t.id} table={t} run={run} />
        ))}
      </div>
    </>
  );
}

function TableEditor({ table, run }: { table: GameTable; run: Runner }) {
  const [game, setGame] = useState(table.game);
  const [editing, setEditing] = useState(false);
  const [meta, setMeta] = useState({ name: table.name, zone: table.zone as string, seats: table.seats, note: table.note });

  useEffect(() => {
    setGame(table.game);
    setMeta({ name: table.name, zone: table.zone, seats: table.seats, note: table.note });
  }, [table.game, table.name, table.zone, table.seats, table.note]);

  const color =
    table.status === 'libre' ? 'free' : table.status === 'ocupada' ? 'busy' : table.status === 'reservada' ? 'reserved' : 'off';

  return (
    <div className="card admin-table">
      <div className="admin-table__head">
        <div className="admin-table__name">
          <span className="dot" style={{ background: `var(--${color})` }} />
          {table.name}
          <small>{ZONE_LABEL[table.zone]} · {table.seats}p</small>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="mini-btn" onClick={() => setEditing((v) => !v)}>{editing ? 'Cerrar' : 'Editar'}</button>
          <button
            className="mini-btn mini-btn--danger"
            onClick={() => {
              if (confirm(`¿Borrar ${table.name}?`)) run(() => api.admin.tables.remove(table.id), 'Mesa borrada');
            }}
          >
            Borrar
          </button>
        </div>
      </div>

      <div className="status-switch">
        {STATUSES.map((s) => (
          <button
            key={s}
            className={`status-btn ${table.status === s ? 'is-active' : ''}`}
            data-status={s}
            onClick={() => run(() => api.admin.tables.update(table.id, { status: s }), `${table.name}: ${STATUS_LABEL[s].toLowerCase()}`)}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="field">
        <label>Juego / nota pública</label>
        <input
          className="input"
          value={game}
          placeholder="Commander, Catan, reserva de las 19:00…"
          onChange={(e) => setGame(e.target.value)}
          onBlur={() => game !== table.game && run(() => api.admin.tables.update(table.id, { game }), 'Actualizado')}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </div>

      {table.status === 'ocupada' && table.occupied_since && (
        <small style={{ color: 'var(--muted-2)', fontSize: '0.76rem' }}>Ocupada {sinceLabel(table.occupied_since)}</small>
      )}

      {editing && (
        <>
          <div className="form-grid">
            <div className="field">
              <label>Nombre</label>
              <input className="input" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Zona</label>
              <select className="select" value={meta.zone} onChange={(e) => setMeta({ ...meta, zone: e.target.value })}>
                {ZONES.map((z) => (
                  <option key={z} value={z}>{ZONE_LABEL[z]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Plazas</label>
              <input
                className="input"
                type="number"
                min={1}
                max={12}
                value={meta.seats}
                onChange={(e) => setMeta({ ...meta, seats: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="field">
            <label>Nota que ve la gente</label>
            <input
              className="input"
              value={meta.note}
              onChange={(e) => setMeta({ ...meta, note: e.target.value })}
              placeholder="Reservada para el club de lectura"
            />
          </div>
          <button className="btn btn--primary btn--sm" onClick={() => run(() => api.admin.tables.update(table.id, meta), 'Mesa guardada')}>
            Guardar cambios
          </button>
        </>
      )}
    </div>
  );
}
