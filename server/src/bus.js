/* Bus muy simple de Server-Sent Events: el front se entera al instante
   de cualquier cambio que haga el admin, sin recargar la página. */
const clients = new Set();

export function addClient(res) {
  clients.add(res);
  return () => clients.delete(res);
}

export function broadcast(event, payload) {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    try {
      res.write(data);
    } catch {
      clients.delete(res);
    }
  }
}

export function clientCount() {
  return clients.size;
}
