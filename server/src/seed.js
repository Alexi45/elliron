import { db, ensureSettings } from './db.js';

const force = process.argv.includes('--force');

/* Próxima fecha con ese día de la semana (1 = lunes ... 7 = domingo) y hora dada */
function nextWeekday(isoDow, time) {
  const [hh, mm] = time.split(':').map(Number);
  const now = new Date();
  const todayDow = now.getDay() === 0 ? 7 : now.getDay();
  let delta = (isoDow - todayDow + 7) % 7;
  if (delta === 0) {
    const passed = now.getHours() > hh || (now.getHours() === hh && now.getMinutes() >= mm);
    if (passed) delta = 7;
  }
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + delta, hh, mm, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hh)}:${pad(mm)}`;
}

const TABLES = [
  ['Mesa 1', 'juego', 4, 'libre', '', ''],
  ['Mesa 2', 'juego', 4, 'libre', '', ''],
  ['Mesa 3', 'juego', 6, 'ocupada', 'Partida en curso', 'Commander'],
  ['Mesa 4', 'juego', 4, 'libre', '', ''],
  ['Mesa 5', 'juego', 6, 'reservada', 'Reservada para esta tarde', ''],
  ['Mesa 6', 'juego', 4, 'libre', '', ''],
  ['Mesa grande', 'torneo', 8, 'libre', 'La mesa de los torneos', ''],
  ['Barra 1', 'cafeteria', 2, 'libre', '', ''],
  ['Barra 2', 'cafeteria', 2, 'ocupada', '', ''],
  ['Rincón de lectura', 'cafeteria', 3, 'libre', 'Sillones junto a la estantería', '']
];

const EVENTS = [
  {
    title: 'Noche de Commander',
    kind: 'magic',
    starts_at: nextWeekday(4, '19:00'),
    duration: '3 h aprox.',
    price: 'Gratis · consumición recomendada',
    capacity: 16,
    taken: 9,
    description:
      'Mesas de cuatro, mazos de cualquier potencia y buen rollo. Si vienes sin grupo te colocamos nosotros. Trae tu mazo o pídenos uno prestado.',
    featured: 1,
    recurring: 'Todos los jueves'
  },
  {
    title: 'Draft de Magic',
    kind: 'magic',
    starts_at: nextWeekday(6, '18:00'),
    duration: '3-4 h',
    price: '15 €',
    capacity: 16,
    taken: 6,
    description: 'Draft del último set con premios en sobres para los mejores. Plazas limitadas, apúntate por Instagram o en la barra.',
    featured: 1,
    recurring: 'Sábados alternos'
  },
  {
    title: 'Tarde de juegos de mesa',
    kind: 'mesa',
    starts_at: nextWeekday(3, '17:30'),
    duration: 'Hasta el cierre',
    price: 'Gratis',
    capacity: 0,
    taken: 0,
    description: 'Abrimos la ludoteca: te explicamos el juego que quieras probar y te buscamos gente para jugar. Ideal si vienes solo.',
    featured: 0,
    recurring: 'Todos los miércoles'
  },
  {
    title: 'Partida de rol abierta',
    kind: 'rol',
    starts_at: nextWeekday(5, '19:30'),
    duration: '3 h',
    price: '5 €',
    capacity: 6,
    taken: 4,
    description: 'One-shot para principiantes. Personajes preparados, no hace falta saber nada ni traer dados.',
    featured: 0,
    recurring: 'Viernes'
  },
  {
    title: 'Club de lectura',
    kind: 'club',
    starts_at: nextWeekday(2, '19:00'),
    duration: '1,5 h',
    price: 'Gratis',
    capacity: 12,
    taken: 7,
    description: 'Fantasía, ciencia ficción y manga. Cada mes un título distinto y café incluido en la charla.',
    featured: 0,
    recurring: 'Un martes al mes'
  }
];

const MENU = [
  ['cafe', 'Café solo / cortado', 'De tueste natural, del bueno', '1,30 €', 1],
  ['cafe', 'Café con leche', 'Vaca, avena, soja o sin lactosa', '1,60 €', 2],
  ['cafe', 'Latte del Lirón', 'Con su cacao por encima y su galletita', '2,40 €', 3],
  ['cafe', 'Chai latte', 'Especiado, calentito, de manta y libro', '2,80 €', 4],
  ['especial', 'Poción de Maná Azul', 'Refresco de frutos azules con soda', '3,20 €', 1],
  ['especial', 'Brebaje del Nigromante', 'Chocolate negro con chili y nata', '3,40 €', 2],
  ['especial', 'Elixir del Aventurero', 'Limonada de jengibre y menta', '3,00 €', 3],
  ['dulce', 'Porción de tarta', 'Casera, la que haya ese día en la vitrina', '3,20 €', 1],
  ['dulce', 'Cookie XXL', 'Chocolate blanco o negro', '2,20 €', 2],
  ['dulce', 'Gofre', 'Con Nutella, dulce de leche o frutos rojos', '4,00 €', 3],
  ['salado', 'Tosta del día', 'Pregunta en barra, cambia cada semana', '4,50 €', 1],
  ['salado', 'Nachos para la mesa', 'Para compartir mientras se baraja', '5,00 €', 2],
  ['bebida', 'Refrescos', 'Fríos, en lata o botella', '2,00 €', 1],
  ['bebida', 'Cerveza artesanal', 'Rotamos marcas locales', '3,00 €', 2],
  ['bebida', 'Infusiones', 'Rooibos, menta poleo, frutas del bosque', '2,00 €', 3]
];

function seed() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM tables').get().n;
  if (count > 0 && !force) {
    console.log('La base de datos ya tiene datos. Usa `npm run seed` para regenerarla.');
    return;
  }

  if (force) {
    db.exec('DELETE FROM tables; DELETE FROM events; DELETE FROM menu_items;');
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('tables','events','menu_items')");
  }

  const insTable = db.prepare(
    `INSERT INTO tables (name, zone, seats, status, note, game, occupied_since, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  TABLES.forEach(([name, zone, seats, status, note, game], i) => {
    const since = status === 'ocupada' ? new Date(Date.now() - (20 + i * 7) * 60000).toISOString() : null;
    insTable.run(name, zone, seats, status, note, game, since, i);
  });

  const insEvent = db.prepare(
    `INSERT INTO events (title, kind, starts_at, duration, price, capacity, taken, description, featured, recurring)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const e of EVENTS) {
    insEvent.run(e.title, e.kind, e.starts_at, e.duration, e.price, e.capacity, e.taken, e.description, e.featured, e.recurring);
  }

  const insMenu = db.prepare(
    'INSERT INTO menu_items (category, name, description, price, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  for (const [category, name, description, price, order] of MENU) {
    insMenu.run(category, name, description, price, order);
  }

  ensureSettings();
  console.log(`Sembrado: ${TABLES.length} mesas, ${EVENTS.length} eventos, ${MENU.length} productos.`);
}

seed();
