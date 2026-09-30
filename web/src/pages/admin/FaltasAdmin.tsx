import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { prettyDate, stamp } from '../../lib/format';
import type { Person, StrikeList, StrikeRecord } from '../../lib/types';
import type { Runner } from './AdminShell';

const KIND_LABEL: Record<string, string> = {
  evento: 'Torneo o evento',
  reserva: 'Reserva de mesa',
  otro: 'Otro'
};

const SEVERITY_LABEL: Record<string, string> = {
  aviso: 'Aviso',
  falta: 'Falta',
  grave: 'Grave'
};

export function FaltasAdmin({ run }: { run: Runner }) {
  const { isAdmin } = useAuth();
  const [data, setData] = useState<StrikeList | null>(null);
  const [scope, setScope] = useState<'activas' | 'todas'>('activas');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setData(await api.admin.incidents.list(scope));
  }, [scope]);

  useEffect(() => {
    load().catch(() => setData({ people: [], threshold: 3, banned: [] }));
  }, [load]);

  const act = (fn: () => Promise<unknown>, msg: string) => run(fn, msg).then(load);

  return (
    <>
      <div className="card panel" style={{ marginBottom: 20 }}>
        <h3>Cómo funciona</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          Cada vez que alguien no aparece a un torneo o a una reserva se le apunta una falta: desde la lista de inscritos del
          evento, desde la reserva («No vino») o a mano aquí. Al llegar a{' '}
          <strong style={{ color: 'var(--reserved)' }}>{data?.threshold ?? 3} faltas</strong> el panel lo marca en rojo, pero
          vetar a alguien es siempre una decisión vuestra, nunca automática. Un veto puede tener fecha de fin y se levanta solo.
        </p>
      </div>

      <div className="admin-row" style={{ marginBottom: 18, gap: 10 }}>
        <div className="filters">
          <button className={`chip ${scope === 'activas' ? 'is-active' : ''}`} onClick={() => setScope('activas')}>
            Con faltas activas
          </button>
          <button className={`chip ${scope === 'todas' ? 'is-active' : ''}`} onClick={() => setScope('todas')}>
            Todo el historial
          </button>
        </div>
        <button className="btn btn--primary btn--sm" style={{ marginLeft: 'auto' }} onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancelar' : '+ Apuntar una falta'}
        </button>
      </div>

      {adding && <NuevaFalta onDone={() => { setAdding(false); load(); }} run={run} />}

      {!data ? (
        <div className="skeleton" />
      ) : data.people.length === 0 ? (
        <div className="empty">
          Nadie ha fallado todavía. Cuando alguien no aparezca, apúntalo aquí y se queda el registro.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {data.people.map((p) => (
            <PersonaCard key={p.id} person={p} threshold={data.threshold} act={act} canBan={isAdmin} />
          ))}
        </div>
      )}
    </>
  );
}

function PersonaCard({
  person,
  threshold,
  act,
  canBan
}: {
  person: StrikeRecord;
  threshold: number;
  act: (fn: () => Promise<unknown>, msg: string) => Promise<void>;
  canBan: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [until, setUntil] = useState(person.standing_until ?? '');
  const [note, setNote] = useState(person.standing_note ?? '');

  const level = person.standing === 'vetado' ? 'vetado' : person.strikes >= threshold ? 'alerta' : 'aviso';

  return (
    <article className={`card strike strike--${level}`}>
      <div className="strike__row">
        <div className="strike__count">
          <strong>{person.strikes}</strong>
          <span>{person.strikes === 1 ? 'falta' : 'faltas'}</span>
        </div>

        <div className="strike__who">
          <strong>{person.name}</strong>
          <small>{person.email}{person.phone ? ` · ${person.phone}` : ''}</small>
          <small>
            Última: {person.last_one ? prettyDate(person.last_one) : '—'}
            {person.total !== person.strikes ? ` · ${person.total - person.strikes} perdonadas` : ''}
          </small>
          {person.standing === 'vetado' && (
            <small className="strike__ban">
              Vetado{person.standing_until ? ` hasta el ${person.standing_until}` : ' sin fecha de fin'}
              {person.standing_note ? ` · ${person.standing_note}` : ''}
            </small>
          )}
        </div>

        <div className="strike__actions">
          <span className={`badge badge--${level === 'vetado' ? 'rechazada' : level === 'alerta' ? 'pendiente' : 'cumplida'}`}>
            {level === 'vetado' ? 'Vetado' : level === 'alerta' ? 'Pasa del límite' : 'Con avisos'}
          </span>
          <button className="mini-btn" onClick={() => setOpen((v) => !v)}>{open ? 'Cerrar' : 'Ver historial'}</button>
        </div>
      </div>

      {open && (
        <div className="reservation__panel">
          <div style={{ display: 'grid', gap: 8 }}>
            {person.incidents.map((i) => (
              <div key={i.id} className={`zone-row ${i.forgiven ? 'is-forgiven' : ''}`}>
                <span style={{ fontSize: '0.86rem' }}>
                  <strong>{i.title || KIND_LABEL[i.kind]}</strong>
                  <small style={{ display: 'block', color: 'var(--muted-2)', fontSize: '0.75rem' }}>
                    {prettyDate(i.happened_on)} · {KIND_LABEL[i.kind]} · {SEVERITY_LABEL[i.severity]}
                    {i.created_by ? ` · apuntada por ${i.created_by}` : ''}
                    {i.forgiven ? ' · PERDONADA' : ''}
                  </small>
                  {i.note && <small style={{ display: 'block', color: 'var(--muted)' }}>«{i.note}»</small>}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="mini-btn"
                    onClick={() =>
                      act(() => api.admin.incidents.update(i.id, { forgiven: !i.forgiven }), i.forgiven ? 'Vuelve a contar' : 'Falta perdonada')
                    }
                  >
                    {i.forgiven ? 'Que cuente' : 'Perdonar'}
                  </button>
                  <button
                    className="mini-btn mini-btn--danger"
                    onClick={() => {
                      if (confirm('¿Borrar esta falta del historial?')) act(() => api.admin.incidents.remove(i.id), 'Falta borrada');
                    }}
                  >
                    Borrar
                  </button>
                </div>
              </div>
            ))}
          </div>

          {canBan && (
            <div className="strike__ban-box">
              <div className="form-grid">
                <div className="field">
                  <label>Veto hasta (vacío = sin fecha)</label>
                  <input className="input" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
                </div>
                <div className="field">
                  <label>Motivo (solo lo veis vosotros y la persona)</label>
                  <input
                    className="input"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Tres plantones seguidos a Commander"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {person.standing === 'vetado' ? (
                  <button
                    className="btn btn--primary btn--sm"
                    onClick={() => act(() => api.admin.incidents.setStanding(person.id, { standing: 'ok' }), 'Veto levantado')}
                  >
                    Levantar el veto
                  </button>
                ) : (
                  <button
                    className="mini-btn mini-btn--danger"
                    onClick={() => {
                      if (confirm(`¿Vetar a ${person.name}? No podrá reservar ni apuntarse a eventos.`)) {
                        act(
                          () =>
                            api.admin.incidents.setStanding(person.id, {
                              standing: 'vetado',
                              standing_note: note,
                              standing_until: until || null
                            }),
                          'Persona vetada'
                        );
                      }
                    }}
                  >
                    Vetar para reservas y torneos
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function NuevaFalta({ onDone, run }: { onDone: () => void; run: Runner }) {
  const [q, setQ] = useState('');
  const [people, setPeople] = useState<Person[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState<Person | null>(null);
  const [form, setForm] = useState({
    kind: 'evento',
    title: '',
    happened_on: new Date().toISOString().slice(0, 10),
    note: '',
    severity: 'falta'
  });

  /* Buscamos mientras se escribe, con un respiro para no llamar a cada tecla */
  useEffect(() => {
    if (chosen) return;
    setSearching(true);
    const id = setTimeout(() => {
      api.admin.incidents
        .people(q)
        .then(setPeople)
        .catch(() => setPeople([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(id);
  }, [q, chosen]);

  return (
    <div className="card panel" style={{ marginBottom: 18 }}>
      <h3>Apuntar una falta</h3>

      {chosen ? (
        <div className="person-chosen">
          <div>
            <strong>{chosen.name}</strong>
            <small>
              {chosen.email}
              {chosen.phone ? ` · ${chosen.phone}` : ''}
              {chosen.strikes > 0 ? ` · ya tiene ${chosen.strikes} ${chosen.strikes === 1 ? 'falta' : 'faltas'}` : ''}
            </small>
          </div>
          <button className="mini-btn" onClick={() => { setChosen(null); setQ(''); }}>
            Cambiar de persona
          </button>
        </div>
      ) : (
        <div className="person-picker">
          <div className="field">
            <label>¿A quién se la apuntas?</label>
            <input
              className="input"
              value={q}
              autoFocus
              onChange={(e) => setQ(e.target.value)}
              placeholder="Escribe un nombre o un correo…"
            />
          </div>

          <div className="person-results">
            {searching && people === null ? (
              <p className="person-results__msg">Buscando…</p>
            ) : people && people.length === 0 ? (
              <p className="person-results__msg">
                Nadie se llama así. Solo salen personas con cuenta en la web; si la falta es de alguien sin cuenta,
                apúntala en la libreta o créale la cuenta desde Usuarios.
              </p>
            ) : (
              (people ?? []).map((u) => (
                <button key={u.id} type="button" className="person-result" onClick={() => setChosen(u)}>
                  <span>
                    <strong>{u.name}</strong>
                    <small>{u.email}{u.phone ? ` · ${u.phone}` : ''}</small>
                  </span>
                  {u.standing === 'vetado' ? (
                    <span className="tag" style={{ color: 'var(--clay)' }}>vetado</span>
                  ) : u.strikes > 0 ? (
                    <span className="tag">{u.strikes} {u.strikes === 1 ? 'falta' : 'faltas'}</span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <div className="form-grid">
        <div className="field">
          <label>Tipo</label>
          <select className="select" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            {Object.entries(KIND_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Qué se perdió</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Noche de Commander"
          />
        </div>
        <div className="field">
          <label>Cuándo</label>
          <input className="input" type="date" value={form.happened_on} onChange={(e) => setForm({ ...form, happened_on: e.target.value })} />
        </div>
        <div className="field">
          <label>Gravedad</label>
          <select className="select" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
            <option value="aviso">Aviso (no cuenta como falta)</option>
            <option value="falta">Falta</option>
            <option value="grave">Grave</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label>Nota</label>
        <input
          className="input"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          placeholder="Avisó media hora tarde, ya había mesa montada"
        />
      </div>

      <button
        className="btn btn--primary btn--sm"
        disabled={!chosen}
        onClick={() => run(() => api.admin.incidents.create({ ...form, user_id: chosen?.id }), 'Falta apuntada').then(onDone)}
      >
        {chosen ? `Apuntar la falta a ${chosen.name.split(' ')[0]}` : 'Elige antes a una persona'}
      </button>
      <small style={{ color: 'var(--muted-2)', fontSize: '0.78rem' }}>
        Queda registrado quién la apunta y cuándo ({stamp(new Date().toISOString())}).
      </small>
    </div>
  );
}
