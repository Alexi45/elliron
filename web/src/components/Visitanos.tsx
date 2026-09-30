import { Link } from 'react-router-dom';
import { Reveal } from './Reveal';
import { IconArrow, IconClock, IconInstagram, IconMapPin } from './Icons';
import { DAY_NAMES } from '../lib/format';
import type { Settings } from '../lib/types';

interface Props {
  settings: Settings;
  todayIndex: number;
  /** Con la tienda cerrada por obras no invitamos a nadie a venir */
  showCta?: boolean;
}

export function Visitanos({ settings, todayIndex, showCta = true }: Props) {
  return (
    <section id="visitanos">
      <div className="shell">
        <Reveal>
          <div className="section-head">
            <span className="eyebrow">Visítanos</span>
            <h2 className="section-title">Estamos a un paseo</h2>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div className="visit">
            <div className="card info-card">
              <div className="info-row">
                <div className="info-row__icon"><IconMapPin size={18} /></div>
                <div>
                  <div className="info-row__label">Dirección</div>
                  <div className="info-row__value">
                    <a href={settings.maps_url} target="_blank" rel="noreferrer noopener">{settings.address}</a>
                  </div>
                </div>
              </div>

              <div className="info-row">
                <div className="info-row__icon"><IconClock size={18} /></div>
                <div style={{ flex: 1 }}>
                  <div className="info-row__label">{showCta ? 'Horario' : 'Horario de siempre'}</div>
                  <div className="hours" style={{ marginTop: 8 }}>
                    {settings.hours.map((h, i) => (
                      <div
                        key={i}
                        className={`hours__row ${showCta && i === todayIndex ? 'is-today' : ''} ${h.closed ? 'is-closed' : ''}`}
                      >
                        <span>{DAY_NAMES[i]}</span>
                        <span>{h.closed ? 'Cerrado' : `${h.open} – ${h.close}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="info-row">
                <div className="info-row__icon"><IconInstagram size={18} /></div>
                <div>
                  <div className="info-row__label">Síguenos</div>
                  <div className="info-row__value">
                    <a href={settings.instagram} target="_blank" rel="noreferrer noopener">@el_liron</a>
                    {' · '}
                    <span style={{ color: 'var(--muted)' }}>novedades, torneos y sorteos</span>
                  </div>
                </div>
              </div>

              <a href={settings.maps_url} target="_blank" rel="noreferrer noopener" className="btn btn--primary btn--block">
                Cómo llegar <IconArrow />
              </a>
            </div>

            <div className="map">
              <iframe
                title="Mapa de El Lirón"
                src="https://www.google.com/maps?q=Calle%20Venecia%206%20Montequinto%20Dos%20Hermanas%20Sevilla&output=embed"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </Reveal>

        {showCta && (
          <Reveal delay={140}>
            <div className="card cta-band" style={{ marginTop: 26 }}>
              <span className="eyebrow">¿Te acercas hoy?</span>
              <h2 className="section-title" style={{ maxWidth: 620 }}>
                Comprueba las mesas y <span className="gold-text">vente</span>
              </h2>
              <p className="lead" style={{ textAlign: 'center' }}>
                Guarda esta página en el móvil: verás el estado de la sala en dos segundos, sin preguntar por WhatsApp.
              </p>
              <Link to="/mesas" className="btn btn--primary">
                Estado de la sala en vivo <IconArrow />
              </Link>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
