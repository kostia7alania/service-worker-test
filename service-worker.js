const CACHE_VERSION = '6.2.1';

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
        path: 'moex.com/', // /\/(_nuxt|fonts|img)\//,
        limit: 100,
    }
};
const WHITE_LIST = [
    'https://api-marketplace.moex.com/',
    'https://mpinv.beta.moex.com/',
    'https://place.moex.com',
    'http://develop.api.place.t2.beta.moex.com/',
];

const BLACK_LIST = [
    '__webpack_hmr'
];

const fallbackImage = '/img/pwa/fallback/fallbackImage.svg';

const resourcesToPrecache = [
    './',
    fallbackImage,
];


const onInstall = event => {
    console.log('[SW] install', event);
    event.waitUntil( // install происходит перед тем, как cache готов, ФИКС - waitUntil
        // Такая конструкция гарантирует, что сервис - воркер не будет установлен, пока код, переданный внутри waitUntil(), не завершится с успехом.
        caches.open(CURRENT_CACHES.core.name) // октрываем кеш с именем cacheName
            .then(cache => {
                self.skipWaiting() // Activate worker immediately
                // cache.addAll([‘page2.html’]); // добавляем в кеш необязательные ресурсы
                return cache.addAll(resourcesToPrecache) // добавляем в кеш обязательные ресурсы
            })
    )
}



// Хук activated - идеально подходит для удаления из кеша, он запускается, когда код SW изменен.
const onActivate = event => {
    console.log('[SW] activate', event);
    const expectedCacheKeys = Object.values(CURRENT_CACHES).map(({ name }) => name).filter(cacheKey => cacheKey.endsWith(CACHE_VERSION))
    event.waitUntil(// passing a Promise to extend the activating stage until the promise is resolved.
        /*Promise, переданный в waitUntil(), заблокирует другие события до своего завершения, поэтому можно быть уверенным,
          что процесс очистки закончится раньше, чем выполнится первое событие fetch на основе нового кеша.*/
        caches.keys()
            .then(cacheKeys => {
                const clearCachePromises = cacheKeys
                    .map(cacheName => { // условия удаления
                        if (!expectedCacheKeys.includes(cacheName)) {
                            console.log('[SW] deleting obsolete cache... =>', cacheName)
                            return caches.delete(cacheName)
                        }
                    })
                // self.ClientRectList.claim() // start controlling all open clients without reloading them
                return Promise.all(clearCachePromises)
            })
    )

}


// отправляет ли браузер в запросах заголовок Save-Data.

const onFetch = event => {
    //caches.match(event.request).then(res => res || fetch(e.request)) // CACHE FIRST
    const request = event.request
    const url = new URL(event.request.url);

    if (request.method !== 'GET' ||
        //url.origin !== location.origin || // same-origin
        !WHITE_LIST.find(item => request.url.startsWith(item)) ||
        BLACK_LIST.find(item => request.url.match(item))) {
        console.warn('[SW] fetch skipped => ', request)
        return;
    }


    /*
      const { saveData } = navigator.connection || {}
      if (saveData) { // в экономном режиме, для экономии, всегда отдавай фоллбек
        if (/img\/logos/.test(request.url)) { // отдавай лого из фолбека, если чел выбрал экономный режим
          event.respondWith(caches.match(fallbackImage));
        }
      }
    */
    const currentCacheObj = Object.values(CURRENT_CACHES).find(curCache => request.url.match(curCache.path)) || CURRENT_CACHES.other // находит первое совпадение
    const CACHE_NAME = currentCacheObj.name // берем КЕШ, соотвествующий запросу


    event.respondWith(
        caches.match(request, { ignoreMethod: true })
            .then(resCached => {
                if (resCached) {
                    console.warn('[SW] fetching from SW.. . . ')
                    return resCached
                }
                return fetch(request, { mode: 'no-cors', credentials: 'include' }) // если нет в кеше, берем из инета и кладем в кеш
                    .then(resFresh => {
                        const resCloned = resFresh.clone();
                        // Check if we received a valid response
                        if (!resFresh || resFresh.status !== 200 /*|| resFresh.type !== 'basic'*/) { // the response type is basic, which indicates that it's a request from our origin. This means that requests to third party assets aren't cached as well.
                            return resFresh;
                        }
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                console.log('[SW]  cache.put =>', request);
                                cache.put(request, resCloned);
                            });
                        return resFresh
                    })
            })
            .catch(error => {
                /*if ( request.headers.get("Accept").includes('image') ) { // fallback for images
                  return caches.match(fallbackImage)
                }*/
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
const onPush = event => console.log('[SW] PPPUUUSSSHHH =>', event);
const onSync = event => console.log('[SW] SYNC =>', event);

self.addEventListener('download', onDownload) // кажется нету такого!
self.addEventListener('install', onInstall);
self.addEventListener('activate', onActivate)
self.addEventListener('message', onMessage);

// => functional events:
self.addEventListener('fetch', onFetch)
self.addEventListener('push', onPush)
self.addEventListener('sync', onSync)
