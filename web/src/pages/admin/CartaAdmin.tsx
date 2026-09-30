import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { MenuItem } from '../../lib/types';
import type { Runner } from './AdminShell';

const CATEGORIES = [
  { key: 'cafe', label: 'Cafés' },
  { key: 'especial', label: 'Bebidas de la casa' },
  { key: 'dulce', label: 'Dulce' },
  { key: 'salado', label: 'Salado' },
  { key: 'bebida', label: 'Refrescos' }
];

export function CartaAdmin({ menu, run }: { menu: MenuItem[]; run: Runner }) {
  const [draft, setDraft] = useState({ category: 'cafe', name: '', description: '', price: '' });

  return (
    <>
      <div className="card panel" style={{ marginBottom: 20 }}>
        <h3>Añadir a la carta</h3>
        <div className="form-grid">
          <div className="field">
            <label>Categoría</label>
            <select className="select" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Nombre</label>
            <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="field">
            <label>Precio</label>
            <input className="input" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="2,50 €" />
          </div>
          <div className="field">
            <label>Descripción</label>
            <input className="input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
        </div>
        <button
          className="btn btn--primary btn--sm"
          disabled={!draft.name}
          onClick={() =>
            run(() => api.admin.menu.create(draft), 'Producto añadido').then(() =>
              setDraft({ category: draft.category, name: '', description: '', price: '' })
            )
          }
        >
          Añadir
        </button>
      </div>

      {CATEGORIES.map((c) => {
        const items = menu.filter((m) => m.category === c.key);
        if (items.length === 0) return null;
        return (
          <div key={c.key} style={{ marginBottom: 22 }}>
            <p className="eyebrow" style={{ marginBottom: 12 }}>{c.label}</p>
            <div className="admin-grid">
              {items.map((m) => (
                <MenuEditor key={m.id} item={m} run={run} />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function MenuEditor({ item, run }: { item: MenuItem; run: Runner }) {
  const [draft, setDraft] = useState({ name: item.name, description: item.description, price: item.price });
  useEffect(() => setDraft({ name: item.name, description: item.description, price: item.price }), [item]);

  return (
    <div className={`card admin-table ${item.available ? '' : 'is-out'}`}>
      <div className="admin-table__head">
        <div className="admin-table__name">
          {item.name}
          {!item.available && <small style={{ color: 'var(--busy)' }}>agotado</small>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="mini-btn"
            onClick={() =>
              run(
                () => api.admin.menu.update(item.id, { available: !item.available }),
                item.available ? 'Marcado como agotado' : 'Disponible otra vez'
              )
            }
          >
            {item.available ? 'Marcar agotado' : 'Reponer'}
          </button>
          <button
            className="mini-btn mini-btn--danger"
            onClick={() => {
              if (confirm(`¿Quitar "${item.name}" de la carta?`)) run(() => api.admin.menu.remove(item.id), 'Producto borrado');
            }}
          >
            Borrar
          </button>
        </div>
      </div>
      <div className="form-grid">
        <div className="field">
          <label>Nombre</label>
          <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <div className="field">
          <label>Precio</label>
          <input className="input" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label>Descripción</label>
        <input className="input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
      </div>
      <button className="btn btn--ghost btn--sm" onClick={() => run(() => api.admin.menu.update(item.id, draft), 'Producto guardado')}>
        Guardar
      </button>
    </div>
  );
}
