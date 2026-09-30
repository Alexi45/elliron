import { Link } from 'react-router-dom';
import { IconInstagram, IconMapPin, IconTikTok, Logo } from './Icons';
import { useBrandLogo } from './Logo';
import type { Settings } from '../lib/types';

export function Footer({ settings }: { settings: Settings | null }) {
  const year = new Date().getFullYear();
  const catalogo = settings?.site_mode === 'catalogo';
  const logoPropio = useBrandLogo();
  return (
    <footer className="footer">
      <div className="shell">
        <div className="footer__grid">
          <div style={{ maxWidth: 320 }}>
            <div className="brand" style={{ marginBottom: 14 }}>
              <Logo size={logoPropio ? 58 : 42} />
              <span>
                {!logoPropio && <span className="brand__name">EL LIRÓN</span>}
                <span className="brand__sub">Juegos, café y libros</span>
              </span>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
              Magic, juegos de mesa, manga, libros y buen café en el corazón de Montequinto. Ven a jugar, quédate a merendar.
            </p>
          </div>

          <div>
            <p className="eyebrow" style={{ marginBottom: 14 }}>La casa</p>
            <div className="footer__links" style={{ flexDirection: 'column', gap: 10 }}>
              {catalogo ? (
                <a href="/#catalogo">Productos</a>
              ) : (
                <>
                  <a href="/#mesas">Mesas en vivo</a>
                  <a href="/#torneos">Torneos y eventos</a>
                  <a href="/#carta">La carta</a>
                </>
              )}
              <a href="/#visitanos">Cómo llegar</a>
              <Link to="/admin">Panel de la tienda</Link>
            </div>
          </div>

          <div>
            <p className="eyebrow" style={{ marginBottom: 14 }}>Dónde estamos</p>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', maxWidth: 260, display: 'flex', gap: 8 }}>
              <IconMapPin size={18} />
              {settings?.address}
            </p>
            <div className="social" style={{ marginTop: 16 }}>
              {settings?.instagram && (
                <a href={settings.instagram} target="_blank" rel="noreferrer noopener" aria-label="Instagram de El Lirón">
                  <IconInstagram />
                </a>
              )}
              {settings?.tiktok && (
                <a href={settings.tiktok} target="_blank" rel="noreferrer noopener" aria-label="TikTok de El Lirón">
                  <IconTikTok />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="footer__bottom">
          <span>© {year} El Lirón · Montequinto, Dos Hermanas (Sevilla)</span>
          <span>Hecho con café y mucho maná.</span>
        </div>
      </div>
    </footer>
  );
}
