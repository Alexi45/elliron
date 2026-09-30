import type {
  AdminUser,
  AppState,
  AuditEntry,
  Incident,
  Person,
  Product,
  StrikeList,
  LironEvent,
  Overview,
  Reservation,
  Session,
  Signup,
  User
} from './types';

/* El token de acceso vive solo en memoria: si alguien cuela un script en la
   página, no puede leerlo de localStorage. El de refresco va en una cookie
   httpOnly que el JavaScript no ve. */
let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;

export const tokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
  },
  onLost: (fn: () => void) => {
    onSessionLost = fn;
  }
};

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let refreshing: Promise<boolean> | null = null;

/** Pide un token nuevo con la cookie de refresco. Solo una petición a la vez. */
async function refreshAccess(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
        if (!res.ok) return false;
        const data = (await res.json()) as { accessToken: string };
        accessToken = data.accessToken;
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => {
          refreshing = null;
        }, 0);
      }
    })();
  }
  return refreshing;
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { ...((options.headers as Record<string, string>) || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`/api${path}`, { ...options, headers, credentials: 'include' });

  if (res.status === 401 && retry) {
    const body = await res.json().catch(() => ({}));
    if ((body as { code?: string }).code === 'sin-sesion' && (await refreshAccess())) {
      return request<T>(path, options, false);
    }
    accessToken = null;
    onSessionLost?.();
    throw new ApiError((body as { error?: string }).error || 'Tu sesión ha caducado.', 401, 'sin-sesion');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      (body as { error?: string }).error || 'No se ha podido completar la operación.',
      res.status,
      (body as { code?: string }).code
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const send = (method: string) => (path: string, data?: unknown) =>
  request(path, { method, body: data === undefined ? undefined : JSON.stringify(data) });

const post = send('POST');
const patch = send('PATCH');
const del = send('DELETE');

interface AuthAnswer {
  accessToken: string;
  user: User;
}

/** El login puede terminar en sesión o pedir el segundo paso */
export type LoginAnswer = AuthAnswer | { needsTwoFactor: true; challenge: string };

export const api = {
  /* ------------------------------------------------------------ público */
  state: () => request<AppState>('/state'),

  /* ------------------------------------------------------------ sesión */
  auth: {
    register: (data: { name: string; email: string; password: string; phone?: string }) =>
      post('/auth/register', data) as Promise<AuthAnswer>,
    login: (data: { email: string; password: string }) => post('/auth/login', data) as Promise<LoginAnswer>,
    loginTwoFactor: (data: { challenge: string; code: string }) => post('/auth/login/2fa', data) as Promise<AuthAnswer>,
    refresh: refreshAccess,
    logout: () => post('/auth/logout') as Promise<{ ok: true }>,
    me: () => request<{ user: User }>('/auth/me'),
    updateProfile: (data: { name?: string; phone?: string }) => patch('/auth/me', data) as Promise<{ user: User }>,
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
      post('/auth/change-password', data) as Promise<{ ok: true; accessToken: string }>,
    sessions: () => request<{ sessions: Session[] }>('/auth/sessions'),
    twoFactor: {
      status: () => request<{ enabled: boolean; backupCodesLeft: number }>('/auth/2fa'),
      setup: () => post('/auth/2fa/setup', {}) as Promise<{ secret: string; uri: string; qr: string }>,
      enable: (code: string) => post('/auth/2fa/enable', { code }) as Promise<{ ok: true; backupCodes: string[] }>,
      disable: (password: string, code: string) => post('/auth/2fa/disable', { password, code }) as Promise<{ ok: true }>,
      newBackupCodes: (code: string) => post('/auth/2fa/backup-codes', { code }) as Promise<{ backupCodes: string[] }>
    },
    closeOtherSessions: () => post('/auth/sessions/close-others') as Promise<{ ok: true; accessToken: string }>
  },

  /* ------------------------------------------------------- cliente */
  reservations: {
    create: (data: Record<string, unknown>) => post('/reservations', data) as Promise<Reservation>,
    mine: () => request<Reservation[]>('/reservations/mine'),
    cancel: (id: number) => post(`/reservations/${id}/cancel`) as Promise<{ ok: true }>
  },

  signups: {
    join: (eventId: number, note = '') => post(`/events/${eventId}/signup`, { note }) as Promise<{ ok: true }>,
    leave: (eventId: number) => del(`/events/${eventId}/signup`) as Promise<{ ok: true }>,
    mine: () => request<{ ids: number[]; events: LironEvent[] }>('/events/mine')
  },

  /* ------------------------------------------------------------- panel */
  admin: {
    overview: () => request<Overview>('/admin/overview'),

    tables: {
      create: (data: Record<string, unknown>) => post('/admin/tables', data),
      update: (id: number, data: Record<string, unknown>) => patch(`/admin/tables/${id}`, data),
      remove: (id: number) => del(`/admin/tables/${id}`),
      freeAll: () => post('/admin/tables/free-all')
    },

    reservations: {
      list: (params: { status?: string; scope?: string } = {}) => {
        const q = new URLSearchParams(params as Record<string, string>).toString();
        return request<Reservation[]>(`/admin/reservations${q ? `?${q}` : ''}`);
      },
      create: (data: Record<string, unknown>) => post('/admin/reservations', data),
      update: (id: number, data: Record<string, unknown>) => patch(`/admin/reservations/${id}`, data),
      remove: (id: number) => del(`/admin/reservations/${id}`)
    },

    events: {
      create: (data: Record<string, unknown>) => post('/admin/events', data),
      update: (id: number, data: Record<string, unknown>) => patch(`/admin/events/${id}`, data),
      remove: (id: number) => del(`/admin/events/${id}`),
      signups: (id: number) => request<Signup[]>(`/admin/events/${id}/signups`),
      removeSignup: (id: number) => del(`/admin/signups/${id}`)
    },

    products: {
      create: (data: Record<string, unknown>) => post('/admin/products', data) as Promise<Product>,
      update: (id: number, data: Record<string, unknown>) => patch(`/admin/products/${id}`, data) as Promise<Product>,
      remove: (id: number) => del(`/admin/products/${id}`),
      move: (id: number, direction: 'arriba' | 'abajo') => post(`/admin/products/${id}/move`, { direction }),
      uploadImage: (dataUrl: string) => post('/admin/products/image', { dataUrl }) as Promise<{ url: string }>
    },

    menu: {
      create: (data: Record<string, unknown>) => post('/admin/menu', data),
      update: (id: number, data: Record<string, unknown>) => patch(`/admin/menu/${id}`, data),
      remove: (id: number) => del(`/admin/menu/${id}`)
    },

    incidents: {
      list: (scope = 'activas') => request<StrikeList>(`/admin/incidents?scope=${scope}`),
      people: (q = '') => request<Person[]>(`/admin/people${q ? `?q=${encodeURIComponent(q)}` : ''}`),
      create: (data: Record<string, unknown>) => post('/admin/incidents', data) as Promise<Incident>,
      update: (id: number, data: Record<string, unknown>) => patch(`/admin/incidents/${id}`, data),
      remove: (id: number) => del(`/admin/incidents/${id}`),
      noShow: (signupId: number, note = '') => post(`/admin/signups/${signupId}/no-show`, { note }),
      setStanding: (userId: number, data: Record<string, unknown>) => patch(`/admin/users/${userId}/standing`, data)
    },

    users: {
      list: (q = '') => request<AdminUser[]>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
      create: (data: Record<string, unknown>) => post('/admin/users', data),
      update: (id: number, data: Record<string, unknown>) => patch(`/admin/users/${id}`, data),
      unlock: (id: number) => post(`/admin/users/${id}/unlock`),
      closeSessions: (id: number) => post(`/admin/users/${id}/close-sessions`),
      remove: (id: number) => del(`/admin/users/${id}`)
    },

    settings: {
      update: (data: Record<string, unknown>) => patch('/admin/settings', data)
    },

    audit: () => request<AuditEntry[]>('/admin/audit')
  }
};
