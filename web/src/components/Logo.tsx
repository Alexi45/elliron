import { useEffect, useState } from 'react';

/* ------------------------------------------------------------------
   El logo de la tienda.

   Si en `web/public/` hay un fichero llamado logo.svg, logo.png o
   logo.webp, se usa ese (el original de la tienda). Si no, se dibuja la
   silueta del lirón del rótulo, que es lo que hay ahora mismo.
   ------------------------------------------------------------------ */

const CANDIDATES = ['/logo.svg', '/logo.png', '/logo.webp'];

let resolved: string | null | undefined;
const waiting = new Set<(value: string | null) => void>();

function probe(src: string) {
  return new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

async function findLogo() {
  for (const src of CANDIDATES) {
    if (await probe(src)) return src;
  }
  return null;
}

function useBrandLogo() {
  const [src, setSrc] = useState<string | null>(resolved ?? null);

  useEffect(() => {
    if (resolved !== undefined) {
      setSrc(resolved);
      return;
    }
    waiting.add(setSrc);
    if (waiting.size === 1) {
      findLogo().then((found) => {
        resolved = found;
        waiting.forEach((fn) => fn(found));
        waiting.clear();
      });
    }
    return () => {
      waiting.delete(setSrc);
    };
  }, []);

  return src;
}

export function Logo({ size = 40, className = '' }: { size?: number; className?: string }) {
  const custom = useBrandLogo();

  if (custom) {
    return <img src={custom} alt="El Lirón" width={size} height={size} className={`mark mark--img ${className}`} />;
  }

  return <LironMark size={size} className={className} />;
}

/** Silueta del lirón del rótulo: cabeza de perfil, oreja redonda y ojo. */
export function LironMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size * 1.18}
      height={size}
      viewBox="0 0 128 108"
      fill="none"
      role="img"
      aria-label="El Lirón"
      className={`mark ${className}`}
    >
      <path
        d="M14 76c1-10 6-19 14-25 8-8 18-14 30-16 2-12 12-20 22-18 12 2 16 14 10 24 14 12 22 34 23 60H22c-6-6-9-16-8-25Z"
        fill="currentColor"
      />
      {/* hocico */}
      <path
        d="M15 79c7 7 15 9 24 7"
        stroke="var(--ink-2, #171A11)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.42"
        fill="none"
      />
      {/* ojo */}
      <circle cx="45" cy="58" r="7" fill="var(--ink, #101209)" />
      <circle cx="42.6" cy="55.2" r="2.1" fill="currentColor" opacity="0.92" />
    </svg>
  );
}
