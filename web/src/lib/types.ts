export type TableStatus = 'libre' | 'ocupada' | 'reservada' | 'fuera';
export type Zone = 'juego' | 'torneo' | 'cafeteria';

export interface GameTable {
  id: number;
  name: string;
  zone: Zone;
  seats: number;
  status: TableStatus;
  note: string;
  game: string;
  free_at: string | null;
  occupied_since: string | null;
  sort_order: number;
  updated_at: string;
}

export interface LironEvent {
  id: number;
  signups?: number;
  occupied?: number;
  spotsLeft?: number | null;
  title: string;
  kind: 'magic' | 'mesa' | 'rol' | 'club' | 'otro';
  starts_at: string;
  duration: string;
  price: string;
  capacity: number;
  taken: number;
  description: string;
  featured: number;
  recurring: string;
}

export interface MenuItem {
  id: number;
  category: string;
  name: string;
  description: string;
  price: string;
  available: number;
  sort_order: number;
}

/* ------------------------------------------------------- catálogo */

export type ProductCategory = 'magic' | 'mesa' | 'libros' | 'manga' | 'merch' | 'otros';
export type ProductStock = 'disponible' | 'pocas' | 'agotado' | 'encargo';

export interface Product {
  id: number;
  name: string;
  category: ProductCategory;
  price: string;
  description: string;
  image: string;
  stock: ProductStock;
  featured: number;
  sort_order: number;
  created_at: string;
}

export interface DayHours {
  closed: boolean;
  open: string;
  close: string;
}

export interface Settings {
  name: string;
  tagline: string;
  address: string;
  maps_url: string;
  instagram: string;
  tiktok: string;
  whatsapp: string;
  phone: string;
  email: string;
  store_mode: 'auto' | 'abierto' | 'cerrado';
  notice: string;
  /* 'catalogo' = escaparate de productos; 'completo' = la web entera */
  site_mode: 'catalogo' | 'completo';
  registration_open: boolean;
  catalog_title: string;
  catalog_intro: string;
  order_phone: string;
  order_area: string;
  order_notice: string;
  reservations_open: boolean;
  reservation_max_people: number;
  strikes_before_ban: number;
  require_2fa_staff: boolean;
  hours: DayHours[];
}

export interface StoreState {
  open: boolean;
  manual: boolean;
  mode: string;
  closingSoon: boolean;
  today: { open: string; close: string } | null;
  dayName: string;
  closesAt: string | null;
  nextOpen: { day: string; time: string } | null;
  now: string;
}

export interface AppState {
  settings: Settings;
  store: StoreState;
  tables: GameTable[];
  summary: {
    total: number;
    free: number;
    occupied: number;
    reserved: number;
    freeSeats: number;
    byZone: { zone: Zone; total: number; free: number }[];
  };
  events: LironEvent[];
  menu: MenuItem[];
  products: Product[];
  updatedAt: string;
}

/* ------------------------------------------------------------------ cuentas */

export type Role = 'user' | 'staff' | 'admin';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  phone: string;
  createdAt: string;
  lastLoginAt: string | null;
  standing: Standing;
  standingNote: string;
  standingUntil: string | null;
  twoFactor: boolean;
  pendingReservations?: number;
  signups?: number;
  strikes?: number;
}

export interface AdminUser extends User {
  status: 'activo' | 'bloqueado';
  reservations: number;
  signups: number;
  strikes: number;
  locked: boolean;
}

export interface Incident {
  id: number;
  user_id: number | null;
  name: string;
  kind: 'evento' | 'reserva' | 'otro';
  source_id: number | null;
  title: string;
  happened_on: string;
  note: string;
  severity: 'aviso' | 'falta' | 'grave';
  forgiven: number;
  created_by: string;
  created_at: string;
}

/** Lo mínimo para el buscador de personas del panel */
export interface Person {
  id: number;
  name: string;
  email: string;
  phone: string;
  standing: Standing;
  strikes: number;
}

export interface StrikeRecord {
  id: number;
  name: string;
  email: string;
  phone: string;
  standing: Standing;
  standing_note: string;
  standing_until: string | null;
  status: string;
  strikes: number;
  total: number;
  last_one: string;
  incidents: Incident[];
}

export interface StrikeList {
  people: StrikeRecord[];
  threshold: number;
  banned: { id: number; name: string; email: string; standing_note: string; standing_until: string | null }[];
}

export type ReservationStatus = 'pendiente' | 'confirmada' | 'rechazada' | 'cancelada' | 'cumplida' | 'ausente';
export type Standing = 'ok' | 'aviso' | 'vetado';

export interface Reservation {
  id: number;
  user_id: number | null;
  name: string;
  phone: string;
  email: string;
  date: string;
  time: string;
  people: number;
  zone: Zone;
  activity: string;
  note: string;
  table_id: number | null;
  table_name?: string | null;
  user_email?: string | null;
  status: ReservationStatus;
  reply: string;
  created_at: string;
  decided_at: string | null;
}

export interface Signup {
  id: number;
  note: string;
  created_at: string;
  user_id: number;
  name: string;
  email: string;
  phone: string;
}

export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  action: string;
  detail: string;
  ip: string;
}

export interface Overview {
  store: StoreState;
  summary: AppState['summary'];
  reservations: { pending: number; today: number; week: number };
  nextReservations: Reservation[];
  users: { total: number; week: number; staff: number };
  events: (LironEvent & { signups: number })[];
  signupsTotal: number;
  strikes: { people: number; banned: number; month: number };
  activity: AuditEntry[];
}

export interface Session {
  id: number;
  user_agent: string;
  ip: string;
  created_at: string;
  expires_at: string;
}
