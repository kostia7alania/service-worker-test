const CACHE_NAME = 'cache-articles-v1';
const CACHE_VERSION = '6.2.1';
const DOMAIN = location.origin;

const CURRENT_CACHES = {
  profile: `profile-cache-v-${CACHE_VERSION}`,
  font: `font-cache-v-${CACHE_VERSION}`
};

const BLACK_LIST = [
  '__webpack_hmr'
];

const fallbackImage = '/img/pwa/fallback/offline.svg';

const resourcesToPrecache = [
  '/_nuxt/app.js',
  '/_nuxt/vendors.app.js',
  '/_nuxt/commons.app.js',
  fallbackImage,
];

const onInstall = event => {
  console.log('[SW] install', event);
  event.waitUntil( // install происходит перед тем, как cache готов, ФИКС - waitUntil
    caches.open(CACHE_NAME) // октрываем кеш с именем cacheName
      .then(cache => {
        // cache.addAll([‘page2.html’]); // добавляем в кеш необязательные ресурсы
        return cache.addAll(resourcesToPrecache) // добавляем в кеш обязательные ресурсы
      })
  )
}

// Хук activated - идеально подходит для удаления из кеша, он запускается, когда код SW изменен.
const onActivate = event => {
  console.log('[SW] activate', event);
  const expectedCacheNames = Object.values(CURRENT_CACHES)
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => { // условия удаления
            if (!expectedCacheNames.includes(cacheName)) {
              console.log('[SW] deleting obsolete cache... =>', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
  )
}

const onFetch = event => {
  //caches.match(event.request).then(res => res || fetch(e.request)) // CACHE FIRST
  const request = event.request

  if ( request.method !== 'GET' ||
      !request.url.match(DOMAIN) ||
      BLACK_LIST.findIndex(item => request.url.match(item)) !== -1 ) {
    return console.warn('[SW] fetch skipped => ', request)
  }
    event.respondWith(
      caches.open(CACHE_NAME)
        .then(cache => {
          return cache.match(request)
            .then(res => {
              const fetchPromise = () => fetch(request)
                .then(networkResponse => {
                  console.log('[SW] cache.put =>', request, networkResponse)
                  cache.put(request, networkResponse.clone())
                  return networkResponse
                })
              if (res) {
                console.warn('[sw] fetching from SW.... ')
                return res
              }
              return fetchPromise() // STRATEGY - Stale While Revalidate
            })
        })
        .catch(error => {
          if (request.headers.get("Accept").includes("image")) { // fallback for images
            return caches.match(fallbackImage)
          }
        })
    )
}


const onDownload  = event => console. log('[SW] download =>',  event);
const onPush      = event => console. log('[SW] push =>',      event);
const onSync      = event => console. log('[SW] sync =>',      event);
const onRedundant = event => console.warn('[SW] redundant =>', event)

self.addEventListener('install', onInstall);
self.addEventListener('activate', onActivate)
self.addEventListener('download', onDownload)
self.addEventListener('fetch', onFetch)
self.addEventListener('push', onPush)
self.addEventListener('sync', onSync)
self.addEventListener('redundant', onRedundant)
