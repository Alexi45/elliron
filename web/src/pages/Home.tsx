import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Reveal } from '../components/Reveal';
import { TableBoard } from '../components/TableBoard';
import { Visitanos } from '../components/Visitanos';
import { BarraPedido, CabeceraCatalogo, Catalogo } from '../components/Catalogo';
import {
  IconArrow, IconBook, IconCalendar, IconClock, IconCoffee, IconDice,
  IconManga, IconMapPin, IconSparkles, IconTicket, IconUsers, Logo
} from '../components/Icons';
import { DAY_NAMES, eventDate, KIND_LABEL, todayLabel, ZONE_LABEL } from '../lib/format';
import type { AppState } from '../lib/types';

const FEATURES = [
  {
    icon: <IconSparkles />,
    title: 'Magic: The Gathering',
    text: 'Sobres y cajas de los últimos sets, singles, fundas y todo lo que necesitas para montar el mazo. Y mesa donde estrenarlo.',
    tags: ['Commander', 'Draft', 'Singles', 'Accesorios']
  },
  {
    icon: <IconDice />,
    title: 'Juegos de mesa',
    text: 'Ludoteca para jugar aquí y estantería para llevártelo a casa. Si no sabes cuál elegir, te lo explicamos y lo probamos juntos.',
    tags: ['Eurogames', 'Party', 'Familiares', 'Dos jugadores']
  },
  {
    icon: <IconManga />,
    title: 'Manga y anime',
    text: 'Tomos, novedades, figuras y ese merchan que llevabas buscando. Pídenos lo que no tengamos y te lo traemos.',
    tags: ['Shonen', 'Seinen', 'Figuras', 'Encargos']
  },
  {
    icon: <IconBook />,
    title: 'Libros',
    text: 'Fantasía, ciencia ficción y terror escogidos uno a uno. Con club de lectura para no comentarlos solo en tu cabeza.',
    tags: ['Fantasía', 'Ciencia ficción', 'Club de lectura']
  },
  {
    icon: <IconCoffee />,
    title: 'Cafetería',
    text: 'Café de verdad, tartas caseras y bebidas con nombres imposibles. Puedes pasar la tarde entera: esa es la idea.',
    tags: ['Café', 'Tartas', 'Refrescos', 'Meriendas']
  },
  {
    icon: <IconUsers />,
    title: 'Rol y comunidad',
    text: 'Partidas abiertas para quien nunca ha tirado un dado y campañas para quien lleva años. Aquí nadie se queda sin grupo.',
    tags: ['One-shots', 'Campañas', 'Principiantes']
  }
];

const MENU_CATEGORIES = [
  { key: 'cafe', label: 'Cafés' },
  { key: 'especial', label: 'Bebidas de la casa' },
  { key: 'dulce', label: 'Dulce' },
  { key: 'salado', label: 'Salado' },
  { key: 'bebida', label: 'Refrescos' }
];

interface Props {
  state: AppState;
  live: boolean;
  lastUpdate: Date | null;
  onRefresh: () => void;
}

export function Home({ state, live, lastUpdate, onRefresh }: Props) {
  const [category, setCategory] = useState('cafe');
  const { user } = useAuth();
  const [joined, setJoined] = useState<number[]>([]);
  const [busyEvent, setBusyEvent] = useState<number | null>(null);

  const loadSignups = () => {
    if (!user) {
      setJoined([]);
      return;
    }
    api.signups
      .mine()
      .then((r) => setJoined(r.ids))
      .catch(() => setJoined([]));
  };

  useEffect(loadSignups, [user]);

  const toggleSignup = async (id: number, isIn: boolean) => {
    setBusyEvent(id);
    try {
      if (isIn) await api.signups.leave(id);
      else await api.signups.join(id);
      loadSignups();
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se ha podido');
    } finally {
      setBusyEvent(null);
    }
  };

  const { settings, store, summary } = state;
  const todayIndex = Math.max(0, DAY_NAMES.indexOf(store.dayName));
  const freeRatio = summary.total ? (summary.free / summary.total) * 100 : 0;
  const menuItems = state.menu.filter((m) => m.category === category);

  /* Tienda cerrada por obras: fuera mesas, torneos, carta y reservas.
     Nada de eso se borra; vuelve cambiando el modo en Ajustes. */
  if (settings.site_mode === 'catalogo') {
    return (
      <main className="catalog-page">
        <CabeceraCatalogo settings={settings} />
        <Catalogo products={state.products} settings={settings} />
        <Visitanos settings={settings} todayIndex={todayIndex} showCta={false} />
        <BarraPedido settings={settings} />
      </main>
    );
  }

  return (
    <main>
      {/* ------------------------------------------------------------ HERO */}
      <section className="hero">
        <div className="shell hero__grid">
          <div>
            <Reveal>
              <span className="eyebrow">Montequinto · Dos Hermanas</span>
              <h1 className="hero__title">
                <span>Café,</span>
                <span className="gold-text">cartas</span>
                <span>y buena gente.</span>
              </h1>
              <p className="hero__sub">
                Una cafetería friki donde se juega a Magic, se prueban juegos de mesa, se leen mangas y se merienda de verdad.
                Antes de venir, mira aquí mismo qué mesas hay libres.
              </p>

              <div className="hero__cta">
                <a href="#mesas" className="btn btn--primary">
                  Ver mesas libres <IconArrow />
                </a>
                <Link to="/reservar" className="btn btn--ghost">
                  <IconCalendar size={18} /> Reservar mesa
                </Link>
              </div>

              <div className="hero__facts">
                <span className="fact"><IconMapPin size={16} /> {settings.address}</span>
                <span className="fact"><IconClock size={16} /> {todayLabel(store)}</span>
              </div>
            </Reveal>
          </div>

          <div className="hero__panel">
            <Reveal delay={140}>
              <div className="card livecard">
                <div className="livecard__top">
                  <div>
                    <span className="eyebrow">Ahora mismo</span>
                    <div className={`livecard__state ${store.open ? 'is-open' : 'is-closed'}`}>
                      {store.open ? 'Estamos abiertos' : 'Ahora cerrado'}
                    </div>
                  </div>
                  <span className={`dot ${store.open ? 'dot--live' : 'dot--closed'}`} style={{ width: 12, height: 12 }} />
                </div>

                {store.open ? (
                  <>
                    <div className="gauge">
                      <span className="gauge__big">{summary.free}</span>
                      <span className="gauge__label">
                        de {summary.total} mesas libres
                        <br />
                        <small style={{ color: 'var(--muted-2)' }}>{summary.freeSeats} sitios donde sentarse</small>
                      </span>
                    </div>
                    <div className="bar">
                      <div className="bar__fill" style={{ width: `${freeRatio}%` }} />
                    </div>
                    {store.closingSoon && (
                      <p style={{ marginTop: 12, fontSize: '0.84rem', color: 'var(--reserved)' }}>
                        Cerramos a las {store.closesAt}, ven pronto.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="gauge" style={{ display: 'block' }}>
                    <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>
                      {store.nextOpen
                        ? `Volvemos a abrir ${store.nextOpen.day} a las ${store.nextOpen.time}.`
                        : 'Consulta nuestro Instagram para el próximo día de apertura.'}
                    </p>
                    <p style={{ color: 'var(--muted-2)', fontSize: '0.84rem', marginTop: 8 }}>
                      Mientras tanto puedes ver cómo quedó la sala y los torneos de esta semana.
                    </p>
                  </div>
                )}

                <div className="livecard__zones">
                  {summary.byZone.map((z) => (
                    <div key={z.zone} className="zone-row">
                      <span>{ZONE_LABEL[z.zone]}</span>
                      <strong style={{ color: z.free > 0 ? 'var(--free)' : 'var(--busy)' }}>
                        {z.free}/{z.total} libres
                      </strong>
                    </div>
                  ))}
                </div>

                <div className="livecard__foot">
                  <span className={`dot ${live ? 'dot--live' : 'dot--closed'}`} />
                  {live ? 'Datos en directo desde la barra' : 'Reconectando con la tienda…'}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {settings.notice && (
        <div className="shell" style={{ marginBottom: 20 }}>
          <Reveal>
            <div className="notice-band">
              <IconSparkles size={18} />
              <span>{settings.notice}</span>
            </div>
          </Reveal>
        </div>
      )}

      {/* ----------------------------------------------------------- MESAS */}
      <section id="mesas">
        <div className="shell">
          <Reveal>
            <div className="section-head">
              <span className="eyebrow">Estado de la sala</span>
              <h2 className="section-title">
                ¿Hay sitio? <span className="gold-text">Míralo antes de salir de casa.</span>
              </h2>
              <p className="lead">
                Esto no es una estimación: es lo que hay ahora mismo en la tienda. Lo actualizamos nosotros desde la barra cada vez
                que una mesa se ocupa o se libera.
              </p>
            </div>
          </Reveal>

          <Reveal delay={90}>
            <TableBoard state={state} live={live} lastUpdate={lastUpdate} onRefresh={onRefresh} />
          </Reveal>
        </div>
      </section>

      {/* --------------------------------------------------------- UNIVERSO */}
      <section id="universo">
        <div className="shell">
          <Reveal>
            <div className="section-head">
              <span className="eyebrow">Qué vas a encontrar</span>
              <h2 className="section-title">Una tienda, una ludoteca y una cafetería en el mismo sitio</h2>
              <p className="lead">
                Puedes venir a comprar y marcharte, o quedarte toda la tarde jugando. Casi todo el mundo acaba haciendo lo segundo.
              </p>
            </div>
          </Reveal>

          <div className="feature-grid">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 70}>
                <article className="card card--hover feature" style={{ height: '100%' }}>
                  <div className="feature__icon">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                  <div className="feature__tags">
                    {f.tags.map((t) => (
                      <span key={t} className="tag">{t}</span>
                    ))}
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- TORNEOS */}
      <section id="torneos">
        <div className="shell">
          <Reveal>
            <div className="section-head">
              <span className="eyebrow">Agenda</span>
              <h2 className="section-title">
                Torneos, partidas abiertas y <span className="gold-text">noches de Commander</span>
              </h2>
              <p className="lead">
                Vengas con grupo o completamente solo, siempre hay hueco en una mesa. Apúntate en la barra o por Instagram.
              </p>
            </div>
          </Reveal>

          {state.events.length === 0 ? (
            <div className="empty">Estamos cerrando la agenda de las próximas semanas. Atento al Instagram.</div>
          ) : (
            <div className="events">
              {state.events.map((e, i) => {
                const d = eventDate(e.starts_at);
                const occupied = e.occupied ?? e.taken;
                const pct = e.capacity ? Math.min(100, Math.round((occupied / e.capacity) * 100)) : 0;
                const isIn = joined.includes(e.id);
                const full = e.capacity > 0 && occupied >= e.capacity;
                return (
                  <Reveal key={e.id} delay={i * 70}>
                    <article className={`card event ${e.featured ? 'event--featured' : ''}`} style={{ height: '100%' }}>
                      <div className="datebox">
                        <div className="datebox__dow">{d.isToday ? 'hoy' : d.isTomorrow ? 'mañana' : d.dow}</div>
                        <div className="datebox__day">{d.day}</div>
                        <div className="datebox__mon">{d.month}</div>
                      </div>

                      <div className="event__body">
                        <h3 className="event__title">
                          {e.title} <span className={`kind kind--${e.kind}`}>{KIND_LABEL[e.kind] ?? 'Evento'}</span>
                        </h3>

                        <div className="event__meta">
                          <span><IconClock size={14} /> {d.time}{e.duration ? ` · ${e.duration}` : ''}</span>
                          {e.price && <span><IconTicket size={14} /> {e.price}</span>}
                          {e.recurring && <span><IconCalendar size={14} /> {e.recurring}</span>}
                        </div>

                        {e.description && <p className="event__desc">{e.description}</p>}

                        {e.capacity > 0 && (
                          <div className="event__capacity">
                            <div className="bar">
                              <div className="bar__fill" style={{ width: `${pct}%` }} />
                            </div>
                            <small>
                              {occupied} de {e.capacity} plazas ocupadas
                              {!full && e.capacity - occupied <= 3 ? ' · quedan pocas' : ''}
                              {full ? ' · completo' : ''}
                            </small>
                          </div>
                        )}

                        <div className="event__join">
                          {user ? (
                            <button
                              className={`btn btn--sm ${isIn ? 'btn--ghost' : 'btn--primary'}`}
                              disabled={busyEvent === e.id || (full && !isIn)}
                              onClick={() => toggleSignup(e.id, isIn)}
                            >
                              {isIn ? 'Estás apuntado · darme de baja' : full ? 'Sin plazas' : 'Apuntarme'}
                            </button>
                          ) : (
                            <Link to="/entrar" state={{ from: '/' }} className="btn btn--ghost btn--sm">
                              Entra para apuntarte
                            </Link>
                          )}
                        </div>
                      </div>
                    </article>
                  </Reveal>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------ CARTA */}
      <section id="carta">
        <div className="shell">
          <Reveal>
            <div className="section-head">
              <span className="eyebrow">La carta</span>
              <h2 className="section-title">Se juega mejor con algo calentito al lado</h2>
              <p className="lead">Precios de barrio, café del bueno y tarta casera. Sin consumición mínima por jugar.</p>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="menu-layout">
              <div className="menu-tabs">
                {MENU_CATEGORIES.map((c) => {
                  const n = state.menu.filter((m) => m.category === c.key).length;
                  if (n === 0) return null;
                  return (
                    <button key={c.key} className={`menu-tab ${category === c.key ? 'is-active' : ''}`} onClick={() => setCategory(c.key)}>
                      {c.label} <small>{n}</small>
                    </button>
                  );
                })}
              </div>

              <div className="card" style={{ padding: '10px 26px' }}>
                <div className="menu-list">
                  {menuItems.map((m) => (
                    <div key={m.id} className={`menu-item ${m.available ? '' : 'is-out'}`}>
                      <div>
                        <div className="menu-item__name">{m.name}</div>
                        {m.description && <div className="menu-item__desc">{m.description}</div>}
                      </div>
                      <div className="menu-item__dots" />
                      <div className="menu-item__price">{m.available ? m.price : 'agotado'}</div>
                    </div>
                  ))}
                  {menuItems.length === 0 && <div className="empty" style={{ border: 0 }}>Nada por aquí todavía.</div>}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* -------------------------------------------------------- NOSOTROS */}
      <section id="nosotros">
        <div className="shell about">
          <Reveal>
            <div>
              <span className="eyebrow">La casa</span>
              <h2 className="section-title" style={{ margin: '14px 0 18px' }}>
                Abrimos para que nadie tenga que jugar <span className="gold-text">solo en casa</span>
              </h2>
              <p className="lead">
                El Lirón nació en Montequinto con una idea sencilla: un sitio donde puedas entrar sin conocer a nadie, pedirte un
                café y acabar jugando una partida con gente nueva.
              </p>
              <p className="lead" style={{ marginTop: 14 }}>
                Mesas grandes, estanterías llenas, torneos entre semana y la barra siempre cerca. Ven con tu mazo, con tu juego o
                con las manos vacías: algo habrá.
              </p>

              <blockquote className="quote">
                «Si el plan de la tarde es una partida de Commander y un chai latte, ya sabes dónde estamos.»
                <cite>El equipo de El Lirón</cite>
              </blockquote>

              <div className="about__stats">
                <div>
                  <strong>{state.tables.length}</strong>
                  <span>mesas para jugar</span>
                </div>
                <div>
                  <strong>+50</strong>
                  <span>juegos en la ludoteca</span>
                </div>
                <div>
                  <strong>7 días</strong>
                  <span>de eventos al mes</span>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="about__art">
              <Logo size={190} />
            </div>
          </Reveal>
        </div>
      </section>

      <Visitanos settings={settings} todayIndex={todayIndex} />
    </main>
  );
}
