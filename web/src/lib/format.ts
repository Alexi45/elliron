const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export function parseLocal(value: string): Date {
  // 'YYYY-MM-DDTHH:mm' se interpreta como hora local, sin sorpresas de zona horaria
  const [date, time = '00:00'] = value.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0);
}

export function eventDate(value: string) {
  const d = parseLocal(value);
  return {
    dow: DOW[d.getDay()],
    day: String(d.getDate()).padStart(2, '0'),
    month: MON[d.getMonth()],
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    isToday: isSameDay(d, new Date()),
    isTomorrow: isSameDay(d, new Date(Date.now() + 86400000))
  };
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "hace 12 min" a partir de un ISO */
export function sinceLabel(iso: string | null): string {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'acaba de empezar';
  if (mins < 60) return `desde hace ${mins} min`;
  const h = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest ? `desde hace ${h} h ${rest} min` : `desde hace ${h} h`;
}

export function agoLabel(date: Date | null): string {
  if (!date) return '—';
  const secs = Math.round((Date.now() - date.getTime()) / 1000);
  if (secs < 5) return 'ahora mismo';
  if (secs < 60) return `hace ${secs} s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `hace ${mins} min`;
  return `hace ${Math.floor(mins / 60)} h`;
}

export const STATUS_LABEL: Record<string, string> = {
  libre: 'Libre',
  ocupada: 'Ocupada',
  reservada: 'Reservada',
  fuera: 'No disponible'
};

export const ZONE_LABEL: Record<string, string> = {
  juego: 'Sala de juego',
  torneo: 'Zona de torneos',
  cafeteria: 'Cafetería'
};

export const KIND_LABEL: Record<string, string> = {
  magic: 'Magic',
  mesa: 'Juegos de mesa',
  rol: 'Rol',
  club: 'Club',
  otro: 'Evento'
};

export const RESERVATION_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  rechazada: 'No pudo ser',
  cancelada: 'Cancelada',
  cumplida: 'Vinieron'
};

export const ROLE_LABEL: Record<string, string> = {
  user: 'Cliente',
  staff: 'Equipo',
  admin: 'Administración'
};

export const ACTION_LABEL: Record<string, string> = {
  login: 'Inició sesión',
  'login-fallido': 'Intento fallido',
  'login-bloqueado': 'Acceso bloqueado',
  registro: 'Nueva cuenta',
  'sesion-reutilizada': 'Token reutilizado',
  'cambio-pw': 'Cambió su contraseña',
  'cambio-pw-fallido': 'Cambio de contraseña fallido',
  'sesiones-cerradas': 'Cerró sus sesiones',
  'perfil-actualizado': 'Actualizó su perfil',
  'mesa-estado': 'Cambió una mesa',
  'mesa-creada': 'Creó una mesa',
  'mesa-borrada': 'Borró una mesa',
  'mesas-liberadas': 'Liberó todas las mesas',
  'reserva-creada': 'Pidió una reserva',
  'reserva-manual': 'Reserva desde la tienda',
  'reserva-estado': 'Resolvió una reserva',
  'reserva-cancelada': 'Canceló su reserva',
  'reserva-borrada': 'Borró una reserva',
  'evento-creado': 'Creó un evento',
  'evento-editado': 'Editó un evento',
  'evento-borrado': 'Borró un evento',
  'evento-inscripcion': 'Se apuntó a un evento',
  'evento-baja': 'Se borró de un evento',
  'inscripcion-borrada': 'Quitó a alguien de un evento',
  'carta-alta': 'Añadió a la carta',
  'carta-baja': 'Quitó de la carta',
  ajustes: 'Cambió los ajustes',
  'usuario-creado': 'Creó una cuenta',
  'usuario-actualizado': 'Cambió permisos',
  'usuario-borrado': 'Borró una cuenta',
  'usuario-desbloqueado': 'Desbloqueó una cuenta',
  'usuario-sesiones-cerradas': 'Cerró sesiones de alguien'
};

/** '2026-09-21 19:04' → '21 sep · 19:04' */
export function stamp(value: string): string {
  const iso = value.includes('T') ? value : value.replace(' ', 'T');
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return value;
  const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d.getDate()} ${MON[d.getMonth()]} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function prettyDate(date: string): string {
  const d = parseLocal(`${date}T00:00`);
  if (Number.isNaN(d.getTime())) return date;
  const MON = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${DAY_NAMES[(d.getDay() + 6) % 7]} ${d.getDate()} de ${MON[d.getMonth()]}`;
}

/** Qué poner en «hoy», teniendo en cuenta que el panel puede forzar la apertura */
export function todayLabel(store: { today: { open: string; close: string } | null; open: boolean }): string {
  if (store.today) return `Hoy ${store.today.open}–${store.today.close}`;
  return store.open ? 'Hoy abierto (horario especial)' : 'Hoy cerrado';
}
