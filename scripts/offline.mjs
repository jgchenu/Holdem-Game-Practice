import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
function files(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? files(join(directory, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`]);
}
const assets = files(dist).filter(name => name !== 'sw.js').sort();
const hash = createHash('sha256');
for (const name of assets) hash.update(name).update(readFileSync(join(dist, name)));
const version = hash.digest('hex').slice(0, 16);
writeFileSync(join(dist, 'sw.js'), `// Generated from the complete production bundle. Do not edit.
const CACHE = 'wendao-shell-${version}';
const ASSETS = ${JSON.stringify(assets.map(name => '/' + name))};
const URLS = new Set(ASSETS);
self.addEventListener('install', event => {
  // An incomplete download must never replace the current offline version.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('wendao-shell-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const path = request.mode === 'navigate' && ['/', '/index.html'].includes(url.pathname)
    ? '/index.html' : url.pathname;
  // API responses, third party services and user data never enter the shell cache.
  if (!URLS.has(path)) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(path)) || fetch(request)));
});
// Updates deliberately wait for all old tabs to close: never reload a live hand.
`);
console.log(`Offline shell ${version}: ${assets.length} local assets`);
