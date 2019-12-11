const CACHE_VERSION = '6.2.1';
const DOMAIN = location.origin;

const CURRENT_CACHES = {
    core: {
        name: `core-cache-v-${CACHE_VERSION}`,
        path: null,
        limit: 100,
    },
    js: {
        name: `js-cache-v-${CACHE_VERSION}`,
        path: /\/_nuxt\/.*\.js/,
        limit: 100,
    },
    css: {
        name: `css-cache-v-${CACHE_VERSION}`,
        path: /\/_nuxt\/.*\.css/,
        limit: 100,
    },
    other: {
        name: `other-cache-v-${CACHE_VERSION}`,
        path: /\/ _nuxt\/.*/,
        limit: 100,
    }
};

const BLACK_LIST = [
    '__webpack_hmr'
];

const fallbackImage = '/img/pwa/fallback/fallbackImage.svg';


const resourcesToPrecache = [
    fallbackImage,
];

const onInstall = event => {
    console.log('[SW] install', event);
    event.waitUntil( // install происходит перед тем, как cache готов, ФИКС - waitUntil
        caches.open(CURRENT_CACHES.core.name) // октрываем кеш с именем cacheName
            .then(cache => {
                // cache.addAll([‘page2.html’]); // добавляем в кеш необязательные ресурсы
                return cache.addAll(resourcesToPrecache) // добавляем в кеш обязательные ресурсы
            })
    )
}

// Хук activated - идеально подходит для удаления из кеша, он запускается, когда код SW изменен.
const onActivate = event => {
    console.log('[SW] activate', event);
    const expectedCacheNames = Object.values(CURRENT_CACHES).map(({ name }) => name)
    event.waitUntil(// passing a Promise to extend the activating stage until the promise is resolved.
        caches.keys()
            .then(cacheNames => {
                const clearCachePromises = cacheNames
                    .map(cacheName => { // условия удаления
                        if (!expectedCacheNames.includes(cacheName)) {
                            console.log('[SW] deleting obsolete cache... =>', cacheName)
                            return caches.delete(cacheName)
                        }
                    })
                return Promise.all(clearCachePromises)
            })
    )
    // self.ClientRectList.claim() // start controlling all open clients without reloading them
}

const isInAccept = (e) => request.headers.get("Accept").includes(e)

// отправляет ли браузер в запросах заголовок Save-Data.
const { saveData } = navigator.connection || {}

const onFetch = event => {
    //caches.match(event.request).then(res => res || fetch(e.request)) // CACHE FIRST
    const request = event.request

    if (request.method !== 'GET' ||
        !request.url.match(DOMAIN) ||
        BLACK_LIST.findIndex(item => request.url.match(item)) !== -1) {
        console.warn('[SW] fetch skipped => ', request)
        return;
    }

    const currentCacheObj = Object.values(CURRENT_CACHES).find(curCache => request.url.match(curCache.path)) || CURRENT_CACHES.other
    const currentCacheName = currentCacheObj.name

    if (saveData) { // в экономном режиме, для экономии, всегда отдавай фоллбек
        if (/img\/logos/.test(request.url)) { // отдавай лого из фолбека, если чел выбрал экономный режим
            event.respondWith(caches.match(fallbackImage));
        }
    }


    event.respondWith(
        caches.open(currentCacheName)
            .then(cache => {
                return cache.match(request)
                    .then(res => {
                        if (res) {
                            console.warn('[SW] fetching from SW.... ')
                            return res
                        }
                        return fetch(request) // STRATEGY - Stale While Revalidate
                            .then(networkResponse => {
                                console.log('[SW] cache.put =>', request, networkResponse)
                                cache.put(request, networkResponse.clone())
                                return networkResponse
                            })
                        throw new Error('Network error')
                    })
            })
            .catch(error => {
                debugger
                if (isInAccept('image')) { // fallback for images
                    return caches.match(fallbackImage)
                }
            })
    )
}
const onMessage = event => {
    console.warn('[SW] message => ', event)
    if (event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
}


const onDownload = event => console.log('[SW] download =>', event);
const onPush = event => console.log('[SW] push =>', event);
const onSync = event => console.log('[SW] sync =>', event);
const onRedundant = event => alert('[SW] redundant =>', event)

self.addEventListener('install', onInstall);
self.addEventListener('activate', onActivate)
self.addEventListener('download', onDownload)
self.addEventListener('fetch', onFetch)
self.addEventListener('push', onPush)
self.addEventListener('sync', onSync)
self.addEventListener('message', onMessage);
self.addEventListener('redundant', onRedundant) // похоже, что такого нет, найти похожее надо
