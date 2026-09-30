import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState } from './types';
import { api } from './api';

const POLL_MS = 10_000;
// Si al abrir el canal no llega nada en este tiempo, algo en medio lo está
// reteniendo (proxys, túneles que no admiten streaming…).
const FIRST_EVENT_MS = 8_000;
// El servidor manda un latido cada 20 s; sin noticias en un minuto, el canal está muerto.
const SILENCE_MS = 60_000;

/**
 * Mantiene el estado de la tienda siempre fresco. Intenta el canal en vivo
 * (SSE) y, si no llega nada por él, pasa a consultar cada 10 s. Solo dice
 * «en directo» cuando de verdad están llegando datos.
 */
export function useLiveState() {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.state();
      setState(data);
      setLastUpdate(new Date());
      setError(null);
      return data;
    } catch {
      setError('No podemos conectar con la tienda ahora mismo.');
      return null;
    }
  }, []);

  useEffect(() => {
    let source: EventSource | null = null;
    let watchdog: number | null = null;
    let cancelled = false;

    const startPolling = () => {
      setLive(false);
      if (pollRef.current) return;
      load();
      pollRef.current = window.setInterval(load, POLL_MS);
    };

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    /* Si el canal se queda callado, lo cerramos y seguimos consultando */
    const armWatchdog = (ms: number) => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = window.setTimeout(() => {
        source?.close();
        source = null;
        startPolling();
      }, ms);
    };

    (async () => {
      const primera = await load();
      if (cancelled) return;

      /* La web de catálogo es informativa: no hay nada que seguir en vivo */
      if (primera?.settings?.site_mode === 'catalogo') return;

      abrirCanal();
    })();

    /** Abre el canal en vivo y se cuida de que no se quede mudo */
    function abrirCanal() {
      try {
        source = new EventSource('/api/stream');
        armWatchdog(FIRST_EVENT_MS);

        source.addEventListener('state', (ev) => {
          if (cancelled) return;
          try {
            setState(JSON.parse((ev as MessageEvent).data));
            setLastUpdate(new Date());
            setError(null);
            setLive(true);
            stopPolling();
            armWatchdog(SILENCE_MS);
          } catch {
            /* mensaje ilegible: lo ignoramos */
          }
        });

        source.addEventListener('ping', () => {
          if (!cancelled) armWatchdog(SILENCE_MS);
        });

        source.onerror = () => {
          if (!cancelled) startPolling();
        };
      } catch {
        startPolling();
      }
    }

    return () => {
      cancelled = true;
      if (watchdog) clearTimeout(watchdog);
      source?.close();
      stopPolling();
    };
  }, [load]);

  return { state, error, live, lastUpdate, refresh: load };
}
