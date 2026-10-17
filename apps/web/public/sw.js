/*
 * MY / BOOK service worker (A12 offline).
 * Pages always come from the network first. The pages a member may need at the desk without a
 * connection (pickup pass, account card, loans) are kept in a cache whenever they load; when the
 * network is down the cached copy is shown, otherwise the offline page in the member's language.
 */
const CACHE = "mybook-v1";
const OFFLINE = ["/tr/offline", "/en/offline"];
const KEEP = [/^\/(tr|en)\/reservations\/confirmed/, /^\/(tr|en)\/account(\/loans)?$/];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode !== "navigate" || request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && KEEP.some((pattern) => pattern.test(url.pathname))) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const locale = url.pathname.startsWith("/en") ? "en" : "tr";
        return (await caches.match(`/${locale}/offline`)) ?? Response.error();
      }),
  );
});
