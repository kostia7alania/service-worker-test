const CACHE_VERSION = '6.2.1';
const DOMAIN = location.origin;

const CURRENT_CACHES = {
    core: {
        name: `core-cache-v-${CACHE_VERSION}`,
        path: null,
    },
    js: {
        name: `js-cache-v-${CACHE_VERSION}`,
        path: /\/_nuxt\/.*\.js/,
    },
    css: {
        name: `css-cache-v-${CACHE_VERSION}`,
        path: /\/_nuxt\/.*\.css/,
    },
    other: {
        name: `other-cache-v-${CACHE_VERSION}`,
        path: /\/ _nuxt\/.*/,
    }
};

const BLACK_LIST = [
    '__webpack_hmr'
];

const fallbackImage = '/img/pwa/fallback/offline.svg';

const resourcesToPrecache = [
    fallbackImage,
];

const onInstall = event => {
    console.log('[SW] install', event);
    event.waitUntil( // install происходит перед тем, как cache готов, ФИКС - waitUntil
        caches.open(CURRENT_CACHES.core) // октрываем кеш с именем cacheName
            .then(cache => {
                // cache.addAll([‘page2.html’]); // добавляем в кеш необязательные ресурсы
                return cache.addAll(resourcesToPrecache) // добавляем в кеш обязательные ресурсы
            })
    )
}

// Хук activated - идеально подходит для удаления из кеша, он запускается, когда код SW изменен.
const onActivate = event => {
    console.log('[SW] activate', event);
    const expectedCacheNames = CURRENT_CACHES.map(e => e.name)
    event.waitUntil(// passing a Promise to extend the activating stage until the promise is resolved.
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames.map(cacheName => { // условия удаления
                    if (!expectedCacheNames.includes(cacheName)) {
                        console.log('[SW] deleting obsolete cache... =>', cacheName)
                        return caches.delete(cacheName)
                    }
                })
            ))
    )
    // self.ClientRectList.claim() // start controlling all open clients without reloading them
}

const onFetch = event => {
    //caches.match(event.request).then(res => res || fetch(e.request)) // CACHE FIRST
    const request = event.request

    if (request.method !== 'GET' ||
        !request.url.match(DOMAIN) ||
        BLACK_LIST.findIndex(item => request.url.match(item)) !== -1) {
        return console.warn('[SW] fetch skipped => ', request)
    }

    const currentCacheObj = Object.values(CURRENT_CACHES).find(curCache => request.url.match(curCache.path)) || CURRENT_CACHES.other
    const currentCacheName = currentCacheObj.name

    event.respondWith(
        caches.open(currentCacheName)
            .then(cache => {
                return cache.match(request)
                    .then(res => {
                        if (res) {
                            console.warn('[sw] fetching from SW.... ')
                            return res
                        }
                        return fetch(request) // STRATEGY - Stale While Revalidate
                            .then(networkResponse => {
                                console.log('[SW] cache.put =>', request, networkResponse)
                                cache.put(request, networkResponse.clone())
                                return networkResponse
                            })
                    })
            })
            .catch(error => {
                if (request.headers.get("Accept").includes("image")) { // fallback for images
                    return caches.match(fallbackImage)
                }
            })
    )
}


const onDownload = event => console.log('[SW] download =>', event);
const onPush = event => console.log('[SW] push =>', event);
const onSync = event => console.log('[SW] sync =>', event);
const onRedundant = event => console.warn('[SW] redundant =>', event)

self.addEventListener('install', onInstall);
self.addEventListener('activate', onActivate)
self.addEventListener('download', onDownload)
self.addEventListener('fetch', onFetch)
self.addEventListener('push', onPush)
self.addEventListener('sync', onSync)
self.addEventListener('redundant', onRedundant)
