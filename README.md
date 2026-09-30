# El Lirón · web de la tienda

Web de **El Lirón**, la cafetería friki de Montequinto (Dos Hermanas): *juegos, café y libros*.
Magic, juegos de mesa, manga y merienda. Tiene tres partes:

- **La web pública**, con el **estado de las mesas en directo**: la gente ve desde el móvil qué
  mesas hay libres antes de venir.
- **Las cuentas de cliente**: registro e inicio de sesión para reservar mesa y apuntarse a los
  torneos.
- **El panel de la tienda**, un dashboard donde el equipo lleva mesas, reservas, eventos, faltas,
  carta, usuarios y ajustes.

```
el-liron/
├── server/   API en Node + Express + SQLite (sin dependencias nativas)
├── web/      Front en React + TypeScript + Vite
├── netlify/  La función que atiende el catálogo cuando se publica en Netlify
└── deploy/   Caddy, nginx, systemd y copias de seguridad
```

## Arrancarlo en local

```bash
npm run install:all   # instala las dependencias de todo
npm run dev           # levanta API (4000) y web (5185) a la vez
```

- Web pública: http://localhost:5185
- Panel de la tienda: http://localhost:5185/admin
- API: http://localhost:4000/api/state

La primera vez se crean solas la base de datos con datos de ejemplo (mesas, eventos y carta) y la
cuenta de administrador que indiques en `server/.env`. Para regenerar los datos de ejemplo:
`npm --prefix server run seed`. Para empezar de cero del todo, borra `server/data/liron.db`.

## La identidad

Los colores son los de la tienda: **verde oliva y gris piedra**, con la tipografía condensada del
rótulo. El logo es la silueta del lirón, redibujada a partir de la fachada.

**Si tienes el logo original**, déjalo en `web/public/` con el nombre `logo.svg`, `logo.png` o
`logo.webp` y la web lo usará automáticamente en todas partes, sin tocar una línea de código. Si no
hay ninguno, se dibuja la silueta.

## Modo catálogo

La web enseña **solo el escaparate de productos**, el teléfono de pedidos y cómo llegar. Las mesas
en vivo, los torneos, la carta y las reservas **no se han borrado**: están escondidas detrás de un
interruptor y vuelven enteras cuando quieras.

El catálogo es informativo: la gente mira, ve el precio y **escribe por WhatsApp al teléfono de la
tienda**. Cada tarjeta lleva un botón «Lo quiero» que abre la conversación con el nombre y el
precio del producto ya escritos, y el número sale además en grande arriba y en una barra fija en el
móvil.

- **Cambiar de modo**: Panel → Ajustes → *Qué enseña la web* → «Solo catálogo» o «Web completa».
- **Crear las tarjetas**: Panel → Catálogo → *Nueva tarjeta*. Cada una lleva foto, nombre,
  categoría (Magic, juegos de mesa, libros, manga, merchandising u otros), precio, descripción y
  disponibilidad. Se ordenan con las flechas y se puede destacar una.
- **Las fotos**: vale una foto del móvil. El navegador la encoge a 1200 px y la convierte a WebP
  antes de subirla, así que la web sigue cargando rápido.
- **La cabecera y el teléfono** (titular, frase de entrada, número, zona de reparto) se editan en
  Ajustes.
- **Las fotos se ven enteras**: nada de recortes. Una caja de mazo alta, un tomo o una caja de juego
  se enseñan completos, con la propia foto difuminada detrás para rellenar los lados.
- **Registro cerrado**: mientras la web sea informativa, nadie puede crearse una cuenta. El
  administrador entra igual por `/entrar`.

## Subirlo a Netlify

Netlify no mantiene un servidor Node encendido, así que allí vive **solo la parte informativa**:
el catálogo, sus fotos y el acceso del administrador, atendidos por una función
(`netlify/functions/api.mjs`) que guarda todo en el almacén de Netlify. Las mesas en vivo, las
reservas y las cuentas de cliente siguen en `server/` esperando a un servidor de verdad.

### Pasos

1. Sube el proyecto a un repositorio de GitHub (o GitLab).
2. En Netlify: **Add new site → Import an existing project** y elige el repositorio. La
   configuración ya viene hecha en `netlify.toml`, no tienes que rellenar nada.
3. En **Site configuration → Environment variables**, añade tres:

   | Variable | Qué pones |
   |----------|-----------|
   | `JWT_SECRET` | Una cadena larga y aleatoria: `openssl rand -base64 48` |
   | `ADMIN_EMAIL` | El correo con el que entras al panel |
   | `ADMIN_PASSWORD` | La contraseña del panel (mínimo 10 caracteres) |

4. **Deploy**. En un minuto tienes la web en `algo.netlify.app`, y en *Domain management* le pones
   tu dominio.

A partir de ahí, tu amigo entra en `tu-dominio/admin`, crea sus tarjetas y aparecen al momento.

### Qué funciona en Netlify y qué no

| | Netlify | Servidor con Node |
|---|---|---|
| Catálogo con fotos y su panel | ✅ | ✅ |
| Cartel de obras, horario, contacto | ✅ | ✅ |
| Entrar como administrador | ✅ | ✅ |
| Mesas en vivo, reservas, torneos, faltas, cuentas de cliente | ❌ | ✅ |

Los productos que crees en Netlify viven en Netlify, y los que crees en tu Mac viven en tu Mac:
son dos sitios distintos. Cuando la tienda reabra y quieras la web entera, llévala a un VPS con la
receta que hay más abajo y pon el modo en «Web completa».

## Cuentas y permisos

| Rol | Qué puede hacer |
|-----|-----------------|
| **Cliente** | Reservar mesa, apuntarse a torneos, ver y cancelar lo suyo, cambiar su contraseña y activar la verificación en dos pasos. |
| **Equipo** | Todo lo anterior más el panel: mesas, reservas, eventos, faltas y carta. |
| **Administración** | Todo, más usuarios, ajustes de la tienda, vetos y el registro de actividad. |

Los roles se cambian en **Panel → Usuarios**. El sistema nunca te deja quedarte sin ningún
administrador activo.

## Seguridad

- **Contraseñas** con `scrypt` (memory-hard) y sal única por usuario. En la base de datos nunca hay
  una contraseña, ni reversible ni en claro.
- **Política sensata**: mínimo 10 caracteres, se rechazan las más comunes y las que contienen tu
  nombre o tu correo. Nada de reglas absurdas de composición.
- **Contraseñas filtradas**: cada alta y cada cambio se comprueba contra Have I Been Pwned usando
  k-anonimato — solo salen los cinco primeros caracteres del SHA-1, nunca la contraseña. Si no hay
  red, no bloquea a nadie. Se puede apagar con `CHECK_PWNED=false`.
- **Verificación en dos pasos (TOTP)** para cualquier cuenta, con QR, códigos de respaldo de un solo
  uso y la opción de exigírsela al equipo desde Ajustes. Funciona con Google Authenticator, Authy,
  1Password, Aegis… y no depende de ningún servicio externo.
- **Sesiones en dos piezas**: un *access token* JWT de 15 minutos que vive solo en memoria (si
  alguien cuela un script, no hay nada que robar en `localStorage`) y un *refresh token* opaco en
  una cookie `httpOnly`, `SameSite=Strict`, `Secure` y con prefijo `__Secure-` en producción, del
  que en la base solo se guarda su SHA-256.
- **Rotación con detección de robo**: cada refresco invalida el anterior. Si alguien reutiliza uno
  ya gastado, se cierran de golpe *todas* las sesiones de esa familia y queda registrado.
- **Fuerza bruta**: límite por IP y por cuenta, y bloqueo de 15 minutos tras 5 intentos fallidos.
  Los mensajes de error son siempre los mismos, así que no se puede averiguar qué correos están
  registrados. La comparación de contraseñas tarda lo mismo acierte o falle.
- **Cabeceras**: CSP, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`,
  `Cross-Origin-Opener-Policy` y HSTS en producción. `Cache-Control: no-store` en toda la API y
  cuerpos de 64 kB como máximo.
- **Registro de actividad**: accesos, intentos fallidos, cambios de permisos y todo lo que toca el
  equipo, con IP y fecha, en **Panel → Actividad**.
- **Al cambiar la contraseña** se cierran las demás sesiones, y cada cliente ve desde su cuenta
  dónde la tiene abierta.

## El panel (`/admin`)

| Sección | Para qué sirve |
|---------|----------------|
| **Resumen** | Mesas libres, ocupación, reservas por confirmar, clientes, gente que ha fallado y últimos movimientos. Con atajos para abrir/cerrar la tienda y vaciar la sala. |
| **Mesas** | Marcar cada mesa como libre / ocupada / reservada / no disponible, escribir a qué se juega, añadir o borrar mesas. |
| **Reservas** | Confirmar o rechazar peticiones, asignar mesa, cambiar hora, escribir un mensaje que el cliente ve en su cuenta, apuntar reservas de teléfono y marcar quién no apareció. |
| **Eventos** | Publicar torneos y ver la lista de inscritos con su contacto, con botón de «no vino». |
| **Faltas** | La lista de control: quién ha fallado, cuántas veces, a qué, y quién lo apuntó. Se perdonan faltas y se veta (o se levanta el veto) a quien haga falta. |
| **Carta** | Editar productos y precios o marcar algo como agotado. |
| **Usuarios** | Buscar clientes, dar de alta al equipo, cambiar roles, suspender cuentas, desbloquear y cerrar sesiones. |
| **Ajustes** | Abierto/cerrado, aviso en portada, reservas, umbral de faltas, 2FA obligatoria, horario y datos de contacto. |
| **Actividad** | El registro de seguridad, con filtro para ver solo lo sensible. |

Todo lo que se toca aquí llega a la web **al instante**, sin recargar: el servidor empuja los
cambios por *server-sent events* y, si la conexión falla, la web reintenta sola cada 15 segundos.

### Cómo funciona el control de faltas

Cuando alguien no aparece se le apunta una falta desde tres sitios: la lista de inscritos del
evento, la reserva confirmada («No vino») o a mano en **Faltas**. Cada falta guarda qué se perdió,
cuándo, una nota y quién la apuntó.

Al llegar al umbral (3 por defecto, configurable) el panel marca a esa persona en rojo, pero
**vetar es siempre una decisión vuestra, nunca automática**. Un veto puede tener fecha de fin y se
levanta solo; mientras dura, esa cuenta no puede reservar ni apuntarse, y ve el motivo en su
propia cuenta. Las faltas se pueden perdonar sin borrarlas del historial.

## Subirlo a un dominio

### Lo más rápido: Docker + Caddy

```bash
cp server/.env.production.example server/.env   # rellena ADMIN_PASSWORD y JWT_SECRET
docker compose up -d --build
```

Después, en `deploy/Caddyfile` cambia `elliron.es` por tu dominio, cópialo a
`/etc/caddy/Caddyfile` y recarga Caddy. El certificado HTTPS lo saca y lo renueva él solo.

### Sin Docker, en un VPS

```bash
npm run install:all
npm run build           # compila el front en web/dist
npm start               # el servidor sirve la API y la web en el puerto 4000
```

Para que arranque solo: `deploy/el-liron.service` (systemd). Delante, `deploy/Caddyfile` o
`deploy/nginx.conf`. **Importante**: el estado en vivo usa server-sent events, así que el proxy
tiene que llevar `proxy_buffering off` (nginx) o `flush_interval -1` (Caddy) en `/api/stream`. Las
dos configuraciones de ejemplo ya lo traen.

### Antes de publicar, repasa

- [ ] `NODE_ENV=production` en `server/.env`.
- [ ] `JWT_SECRET` generado con `openssl rand -base64 48`.
- [ ] `ADMIN_PASSWORD` cambiada, y cambiarla otra vez desde el panel al entrar.
- [ ] `CORS_ORIGIN=https://tu-dominio`.
- [ ] HTTPS puesto (sin él, las cookies de sesión no viajan).
- [ ] Activar la verificación en dos pasos en las cuentas del equipo.
- [ ] Cambiar `TU-DOMINIO` en `web/public/robots.txt` y `web/public/sitemap.xml`.
- [ ] Programar la copia de seguridad: `0 4 * * * /srv/el-liron/deploy/backup.sh`.
- [ ] Revisar el horario y la carta reales en **Ajustes**.

Requisitos del servidor: **Node 22 o superior** (usa el SQLite que viene dentro de Node, así que no
hay que compilar nada) y unos 200 MB de disco. Vale cualquier VPS pequeño, Railway, Render o Fly.

### Copias de seguridad

`deploy/backup.sh` hace una copia en caliente de la base de datos (mesas, reservas, clientes,
faltas), la comprime y borra las de más de 30 días. Ahí está todo: si guardas ese fichero, lo
tienes todo.

## Detalles que conviene saber

- **Horario**: se define por días en Ajustes y la web calcula sola si está abierto, en hora de
  Madrid, independientemente de dónde esté el servidor. Las reservas se validan contra ese mismo
  horario, así que nadie puede pedir mesa un día que cerráis.
- **Datos reales**: la dirección (C. Venecia, 6 · Local 18), el Instagram (@el_liron) y el lema
  («Juegos, café y libros») son los de la tienda. El horario, la carta y los eventos son ejemplos
  realistas: cámbialos desde Ajustes.
- **Lo que no hay (todavía)**: no se envían correos, así que no existe «he olvidado mi contraseña»
  ni aviso automático al confirmar una reserva. El cliente lo ve en su cuenta y vosotros tenéis su
  teléfono. Cuando quieras añadirlo, el sitio natural es `server/src/routes/auth.js`.
