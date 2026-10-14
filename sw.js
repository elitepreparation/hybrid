// Service worker: deja la web instalable y permite entrenar sin señal.
// - Páginas (navegación): primero la red; si no hay conexión, la última copia guardada.
// - Archivos propios y fuentes (estilos, scripts, imágenes): se sirven de la copia guardada y se actualizan en segundo plano.
// - El servidor (Apps Script) y Drive nunca se guardan acá: los datos del alumno los maneja la propia web.
const CACHE = "elite-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!/^https?:$/.test(url.protocol)) return;
  if (url.hostname === "script.google.com" || url.hostname.endsWith("googleusercontent.com") || url.hostname.endsWith("drive.google.com") || url.hostname.endsWith("docs.google.com")) return;

  // páginas: red primero, copia guardada si no hay señal
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match("perfil.html", { ignoreSearch: true })))
    );
    return;
  }

  // archivos propios y fuentes: copia guardada y actualización en segundo plano
  const propio = url.origin === self.location.origin;
  const fuente = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!propio && !fuente) return;
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((hit) => {
        const red = fetch(req)
          .then((res) => {
            if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || red;
      })
    )
  );
});
