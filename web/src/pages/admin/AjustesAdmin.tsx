import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { DAY_NAMES } from '../../lib/format';
import type { Settings } from '../../lib/types';
import type { Runner } from './AdminShell';

export function AjustesAdmin({ settings, run }: { settings: Settings; run: Runner }) {
  const [draft, setDraft] = useState<Settings>(settings);
  useEffect(() => setDraft(settings), [settings]);

  const setHour = (i: number, patch: Partial<Settings['hours'][number]>) => {
    setDraft({ ...draft, hours: draft.hours.map((h, idx) => (idx === i ? { ...h, ...patch } : h)) });
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="card panel">
        <h3>Qué enseña la web</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
          Con la tienda de obras, la web solo enseña el escaparate de productos y cómo llegar. Nada se borra: al volver
          al modo completo reaparecen las mesas en vivo, los torneos, la carta y las reservas tal y como estaban.
        </p>
        <div className="status-switch" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {([
            ['catalogo', 'Solo catálogo'],
            ['completo', 'Web completa']
          ] as const).map(([modo, etiqueta]) => (
            <button
              key={modo}
              className={`status-btn ${draft.site_mode === modo ? 'is-active' : ''}`}
              data-status={modo === 'completo' ? 'libre' : 'reservada'}
              onClick={() => run(() => api.admin.settings.update({ site_mode: modo }), 'Cambiado lo que ve el público')}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        <label className="switch-row">
          <input
            type="checkbox"
            checked={draft.registration_open === true}
            onChange={(e) => run(() => api.admin.settings.update({ registration_open: e.target.checked }), 'Guardado')}
          />
          <span>
            <strong>Dejar que la gente se cree una cuenta</strong>
            <small>Apagado mientras la web sea informativa. Tú sigues entrando igual al panel.</small>
          </span>
        </label>
      </div>

      <div className="card panel">
        <h3>El cartel de las obras</h3>
        <div className="form-grid">
          <div className="field">
            <label>Titular</label>
            <input
              className="input"
              value={draft.closure_title ?? ''}
              onChange={(e) => setDraft({ ...draft, closure_title: e.target.value })}
              placeholder="Estamos de obras"
            />
          </div>
          <div className="field">
            <label>Fecha de reapertura (texto libre)</label>
            <input
              className="input"
              value={draft.reopen_date ?? ''}
              onChange={(e) => setDraft({ ...draft, reopen_date: e.target.value })}
              placeholder="11 de octubre"
            />
          </div>
        </div>
        <div className="field">
          <label>Explicación</label>
          <textarea
            className="textarea"
            value={draft.closure_notice ?? ''}
            onChange={(e) => setDraft({ ...draft, closure_notice: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Frase de entrada al catálogo</label>
          <input
            className="input"
            value={draft.catalog_intro ?? ''}
            onChange={(e) => setDraft({ ...draft, catalog_intro: e.target.value })}
          />
        </div>
        <button
          className="btn btn--primary btn--sm"
          onClick={() =>
            run(
              () =>
                api.admin.settings.update({
                  closure_title: draft.closure_title,
                  closure_notice: draft.closure_notice,
                  reopen_date: draft.reopen_date,
                  catalog_intro: draft.catalog_intro
                }),
              'Cartel guardado'
            )
          }
        >
          Guardar el cartel
        </button>
      </div>

      <div className="card panel">
        <h3>¿Abierto o cerrado?</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
          Normalmente déjalo en automático y la web usará el horario. Fuérzalo si cierras antes o abres un día suelto.
        </p>
        <div className="status-switch" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {(['auto', 'abierto', 'cerrado'] as const).map((m) => (
            <button
              key={m}
              className={`status-btn ${draft.store_mode === m ? 'is-active' : ''}`}
              data-status={m === 'abierto' ? 'libre' : m === 'cerrado' ? 'ocupada' : 'reservada'}
              onClick={() => run(() => api.admin.settings.update({ store_mode: m }), 'Estado de la tienda actualizado')}
            >
              {m === 'auto' ? 'Automático' : m === 'abierto' ? 'Forzar abierto' : 'Forzar cerrado'}
            </button>
          ))}
        </div>

        <div className="field">
          <label>Aviso en la portada (déjalo vacío para ocultarlo)</label>
          <input
            className="input"
            value={draft.notice}
            placeholder="Este sábado cerramos a las 18:00 por torneo privado"
            onChange={(e) => setDraft({ ...draft, notice: e.target.value })}
          />
        </div>
        <button className="btn btn--primary btn--sm" onClick={() => run(() => api.admin.settings.update({ notice: draft.notice }), 'Aviso guardado')}>
          Guardar aviso
        </button>
      </div>

      <div className="card panel">
        <h3>Reservas por la web</h3>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={draft.reservations_open !== false}
            onChange={(e) => run(() => api.admin.settings.update({ reservations_open: e.target.checked }), 'Guardado')}
          />
          <span>
            <strong>Aceptar reservas de mesa</strong>
            <small>Si lo apagas, la web dice que se pasen o escriban por Instagram.</small>
          </span>
        </label>
        <div className="field" style={{ maxWidth: 220 }}>
          <label>Máximo de personas por reserva</label>
          <input
            className="input"
            type="number"
            min={1}
            max={20}
            value={draft.reservation_max_people ?? 8}
            onChange={(e) => setDraft({ ...draft, reservation_max_people: Number(e.target.value) })}
            onBlur={(e) => run(() => api.admin.settings.update({ reservation_max_people: Number(e.target.value) }), 'Guardado')}
          />
        </div>
      </div>

      <div className="card panel">
        <h3>Faltas y seguridad</h3>
        <div className="form-grid">
          <div className="field">
            <label>Faltas antes de avisar en rojo</label>
            <input
              className="input"
              type="number"
              min={1}
              max={10}
              value={draft.strikes_before_ban ?? 3}
              onChange={(e) => setDraft({ ...draft, strikes_before_ban: Number(e.target.value) })}
              onBlur={(e) => run(() => api.admin.settings.update({ strikes_before_ban: Number(e.target.value) }), 'Guardado')}
            />
          </div>
        </div>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={draft.require_2fa_staff === true}
            onChange={(e) => run(() => api.admin.settings.update({ require_2fa_staff: e.target.checked }), 'Guardado')}
          />
          <span>
            <strong>Exigir verificación en dos pasos al equipo</strong>
            <small>Quien lleve el panel tendrá que activarla en su cuenta para poder usarlo.</small>
          </span>
        </label>
      </div>

      <div className="card panel">
        <h3>Horario</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          {draft.hours.map((h, i) => (
            <div key={i} className="admin-row" style={{ alignItems: 'center', gap: 10 }}>
              <span style={{ width: 92, textTransform: 'capitalize', color: 'var(--muted)', fontSize: '0.9rem' }}>{DAY_NAMES[i]}</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.84rem', color: 'var(--muted)' }}>
                <input type="checkbox" checked={h.closed} onChange={(e) => setHour(i, { closed: e.target.checked })} /> Cerrado
              </label>
              <input
                className="input"
                type="time"
                style={{ width: 120, flex: 'none' }}
                value={h.open}
                disabled={h.closed}
                onChange={(e) => setHour(i, { open: e.target.value })}
              />
              <input
                className="input"
                type="time"
                style={{ width: 120, flex: 'none' }}
                value={h.close}
                disabled={h.closed}
                onChange={(e) => setHour(i, { close: e.target.value })}
              />
            </div>
          ))}
        </div>
        <button className="btn btn--primary btn--sm" onClick={() => run(() => api.admin.settings.update({ hours: draft.hours }), 'Horario guardado')}>
          Guardar horario
        </button>
      </div>

      <div className="card panel">
        <h3>Datos de la tienda</h3>
        <div className="form-grid">
          {(
            [
              ['address', 'Dirección'],
              ['maps_url', 'Enlace de Google Maps'],
              ['instagram', 'Instagram'],
              ['tiktok', 'TikTok'],
              ['phone', 'Teléfono'],
              ['email', 'Email']
            ] as [keyof Settings, string][]
          ).map(([key, label]) => (
            <div className="field" key={key}>
              <label>{label}</label>
              <input
                className="input"
                value={String(draft[key] ?? '')}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <button
          className="btn btn--primary btn--sm"
          onClick={() =>
            run(
              () =>
                api.admin.settings.update({
                  address: draft.address,
                  maps_url: draft.maps_url,
                  instagram: draft.instagram,
                  tiktok: draft.tiktok,
                  phone: draft.phone,
                  email: draft.email
                }),
              'Datos guardados'
            )
          }
        >
          Guardar datos
        </button>
      </div>
    </div>
  );
}
