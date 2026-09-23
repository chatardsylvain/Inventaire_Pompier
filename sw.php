<?php
/**
 * sw.php �?" Service Worker généré dynamiquement
 * Les versions des assets sont calculées via filemtime() pour invalider
 * automatiquement le cache navigateur à chaque déploiement.
 *
 * Remplace sw.js �?" enregistré via script.js : navigator.serviceWorker.register('./sw.php')
 * Généré le 2026-09-13
 */
header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate'); // le SW lui-même ne doit pas être mis en cache

$d = __DIR__;
$v_styles   = @filemtime("$d/styles.css")   ?: 0;
$v_script   = @filemtime("$d/script.js")    ?: 0;
$v_imgopt   = @filemtime("$d/image-optimizer.js") ?: 0;
$v_adminjs  = @filemtime("$d/admin.js")     ?: 0;
$v_admincss = @filemtime("$d/admin.css")    ?: 0;

// CACHE_VERSION = concaténation des timestamps des assets principaux
// Change automatiquement dès qu'un fichier est modifié
$cache_version = 'v-' . ($v_styles + $v_script + $v_adminjs + $v_admincss);
?>
/**
 * sw.php �?" Service Worker de l'application Inventaire Pompier (généré dynamiquement)
 *
 * Stratégies appliquées :
 *  - Assets statiques (HTML, CSS, JS, fonts, icônes) �?' Cache First
 *  - Données dynamiques (api/data.php) �?' Network First avec fallback cache
 *  - Images �?' Cache First (les images de l'inventaire changent rarement)
 *
 * Cache invalidé automatiquement via filemtime() �?" plus besoin d'incrémenter manuellement.
 */

const CACHE_VERSION  = '<?= $cache_version ?>';
const CACHE_STATIC   = `Caserne-static-${CACHE_VERSION}`;
const CACHE_DATA     = `Caserne-data-${CACHE_VERSION}`;
const CACHE_IMAGES   = `Caserne-images-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
    './',
    './styles.css?v=<?= $v_styles ?>',
    './script.js?v=<?= $v_script ?>',
    './image-optimizer.js?v=<?= $v_imgopt ?>',
    './api/data.php?action=get_all',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_STATIC)
            .then(cache => {
                return Promise.all(
                    PRECACHE_ASSETS.map(url =>
                        cache.add(url).catch(err => {
                            console.warn('[SW] �?chec du précaching pour', url, err);
                        })
                    )
                );
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    const validCaches = [CACHE_STATIC, CACHE_DATA, CACHE_IMAGES];
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => !validCaches.includes(key))
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Ne pas intercepter les requêtes admin ou API dynamiques
    if (url.pathname.includes('admin') ||
        url.pathname.includes('auth.php') ||
        url.pathname.includes('alerts.php') ||
        url.pathname.includes('inventory.php') ||
        url.pathname.includes('cleaning.php') ||
        url.pathname.includes('upload.php') ||
        url.pathname.includes('users.php') ||
        url.pathname.includes('regenerate_qrcodes.php') ||
        url.pathname.includes('ct.php') ||
        url.pathname.includes('inventory.php') ||
        url.pathname.includes('cleaning.php') ||
        event.request.method !== 'GET') {
        return;
    }

    if (url.pathname.includes('data.php')) {
        event.respondWith(networkFirst(event.request, CACHE_DATA));
        return;
    }

    if (/\.(webp|jpg|jpeg|png|gif|svg)$/i.test(url.pathname)) {
        event.respondWith(cacheFirst(event.request, CACHE_IMAGES));
        return;
    }

    event.respondWith(cacheFirst(event.request, CACHE_STATIC));
});

async function networkFirst(request, cacheName) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response(
            JSON.stringify({ error: 'Données indisponibles hors ligne.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

async function cacheFirst(request, cacheName) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch {
        return new Response('Ressource indisponible hors ligne.', { status: 503 });
    }
}
