/**
 * sw.js — Service Worker de l'application Inventaire TMC
 *
 * Stratégies appliquées :
 *  - Assets statiques (HTML, CSS, JS, fonts, icônes) → Cache First
 *    Le cache est servi immédiatement, mis à jour en arrière-plan si le réseau est dispo.
 *  - Données dynamiques (api/data.php) → Network First avec fallback cache
 *    On essaie toujours le réseau pour avoir des données fraîches.
 *    Si le réseau échoue, on sert le cache (inventaire consulté hors ligne).
 *  - Images → Cache First (les images de l'inventaire changent rarement)
 *
 * Pour invalider le cache lors d'une mise à jour, incrémenter CACHE_VERSION.
 */

// IMPORTANT : incrémenter CACHE_VERSION à chaque changement de PRECACHE_ASSETS
// pour forcer l'invalidation du cache chez les utilisateurs.
// Les URLs ci-dessous DOIVENT correspondre exactement aux versions (?v=x.y)
// chargées par index.php / admin.php, sinon cache.addAll() échoue silencieusement
// et le Service Worker entier ne s'installe jamais (bug corrigé le 01/07/2026 :
// les versions étaient désynchronisées et ./index.html n'existe pas sur ce site,
// qui utilise index.php).
const CACHE_VERSION  = 'v4';
const CACHE_STATIC   = `tmc-static-${CACHE_VERSION}`;
const CACHE_DATA     = `tmc-data-${CACHE_VERSION}`;
const CACHE_IMAGES   = `tmc-images-${CACHE_VERSION}`;

// Assets à pré-cacher dès l'installation (shell de l'application)
const PRECACHE_ASSETS = [
    './',
    './styles.css?v=1.6',
    './script.js?v=1.9',
    './image-optimizer.js?v=1.0',
    './api/data.php?action=get_all',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
];

// ─────────────────────────────────────────────────────────────────────────────
// INSTALLATION : pré-cache les assets critiques
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_STATIC)
            .then(cache => {
                // On ajoute chaque ressource individuellement (au lieu de cache.addAll qui est
                // atomique) : si une seule URL échoue (404, offline...), les autres restent
                // tout de même mises en cache et l'installation du Service Worker aboutit.
                return Promise.all(
                    PRECACHE_ASSETS.map(url =>
                        cache.add(url).catch(err => {
                            console.warn('[SW] Échec du précaching pour', url, err);
                        })
                    )
                );
            })
            .then(() => self.skipWaiting()) // Prend effet immédiatement sans attendre le reload
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVATION : supprime les anciens caches
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
    const validCaches = [CACHE_STATIC, CACHE_DATA, CACHE_IMAGES];

    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => !validCaches.includes(key))
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim()) // Prend le contrôle des onglets ouverts immédiatement
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// FETCH : interception des requêtes réseau
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Ne pas intercepter les requêtes vers l'admin ou les API d'écriture
    if (url.pathname.includes('admin') ||
        url.pathname.includes('auth.php') ||
		url.pathname.includes('alerts.php') ||
        url.pathname.includes('upload.php') ||
        url.pathname.includes('users.php') ||
        url.pathname.includes('regenerate_qrcodes.php') ||
        event.request.method !== 'GET') {
        return; // Laisser passer sans interception
    }

    // Données dynamiques → Network First
    if (url.pathname.includes('data.php')) {
        event.respondWith(networkFirst(event.request, CACHE_DATA));
        return;
    }

    // Images → Cache First
    if (/\.(webp|jpg|jpeg|png|gif|svg)$/i.test(url.pathname)) {
        event.respondWith(cacheFirst(event.request, CACHE_IMAGES));
        return;
    }

    // Tout le reste (HTML, CSS, JS, fonts) → Cache First
    event.respondWith(cacheFirst(event.request, CACHE_STATIC));
});

// ─────────────────────────────────────────────────────────────────────────────
// STRATÉGIE : Network First
// Tente le réseau, met en cache la réponse, utilise le cache si réseau KO.
// ─────────────────────────────────────────────────────────────────────────────
async function networkFirst(request, cacheName) {
    try {
        const networkResponse = await fetch(request);

        // Met à jour le cache uniquement si la réponse est valide
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch {
        // Réseau indisponible → fallback cache
        const cached = await caches.match(request);
        if (cached) return cached;

        // Aucun cache disponible → réponse d'erreur claire
        return new Response(
            JSON.stringify({ error: 'Données indisponibles hors ligne.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// STRATÉGIE : Cache First
// Sert depuis le cache si disponible, sinon va chercher sur le réseau et met en cache.
// ─────────────────────────────────────────────────────────────────────────────
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
        // Ressource introuvable partout
        return new Response('Ressource indisponible hors ligne.', { status: 503 });
    }
}
