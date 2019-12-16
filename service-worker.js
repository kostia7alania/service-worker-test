const CACHE_VERSION = '6.2.3';

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
    'http://127.0.0.1:5500/'
];

const BLACK_LIST = [
    '__webpack_hmr'
];

const fallbackImage = '/img/pwa/fallback/fallbackImage.svg';

const resourcesToPrecache = [
    './',
    fallbackImage,
];

self.addEventListener('install', onInstall);
self.addEventListener('activate', onActivate)
self.addEventListener('message', onMessage);

main().catch(err => log('main err', err))

// ******************************

async function main() {
    log('main is starting...')
    await sendSWMessage({ requestStatusUpdate: true })
}

async function onInstall(evt) {
    log('install', evt)
    evt.waitUntil( // install происходит перед тем, как cache готов, ФИКС - waitUntil
        // Такая конструкция гарантирует, что сервис - воркер не будет установлен, пока код, переданный внутри waitUntil(), не завершится с успехом.
        caches.open(CURRENT_CACHES.core.name) // октрываем кеш с именем cacheName
        .then(cache => {
            self.skipWaiting() // Activate worker immediately
                // cache.addAll([‘page2.html’]); // добавляем в кеш необязательные ресурсы
            return cache.addAll(resourcesToPrecache) // добавляем в кеш обязательные ресурсы
        })
    )
}
async function sendSWMessage(msg) {
    const allClients = await clients.matchAll({ includeUncontrolled: true })
    return Promise.all(
        allClients.map(function clientMsg(client) {
            const chan = new MessageChannel();
            chan.port1.onmessage = onMessage;
            return client.postMessage(msg, [chan.port2]);
        })
    )
}

function onMessage({ data }) {
    if (data.statusUpdate) {
        const { isOnline, isLoggedIn } = data.statusUpdate;
        log(`status update, isOnline: ${isOnline}, isLoggedIn: ${isLoggedIn}`, data)
    }
}
// Хук activated - идеально подходит для удаления из кеша, он запускается, когда код SW изменен.
function onActivate(evt) {
    log('activate', evt)
    evt.waitUntil(handleActivation());
}

async function handleActivation() {
    // passing a Promise to extend the activating stage until the promise is resolved.
    /*Promise, переданный в waitUntil(), заблокирует другие события до своего завершения, поэтому можно быть уверенным,
      что процесс очистки закончится раньше, чем выполнится первое событие fetch на основе нового кеша.*/
    await caches.keys()
        .then(cacheKeys => {
            const clearCachePromises = cacheKeys
                .map(cacheName => { // условия удаления
                    if (!expectedCacheKeys().includes(cacheName)) {
                        log('deleting obsolete cache...', cacheName)
                        return caches.delete(cacheName)
                    }
                })
            return Promise.all(clearCachePromises)
        })
        //self.ClientRectList.claim() // start controlling all open clients without reloading them
    await clients.claim();
    log('activated')
}


const onFetch = event => {
    //caches.match(event.request).then(res => res || fetch(e.request)) // CACHE FIRST
    const request = event.request
        // const url = new URL(event.request.url);
    if (request.method !== 'GET' ||
        //url.origin !== location.origin || // same-origin
        !WHITE_LIST.find(item => request.url.startsWith(item)) ||
        BLACK_LIST.find(item => request.url.match(item))) {
        log('fetch skipped', request)
        return;
    }
    /*const { saveData } = navigator.connection || {}
    // отправляет ли браузер в запросах заголовок Save-Data.
    if (saveData) { // в экономном режиме, для экономии, всегда отдавай фоллбек
    if (/img\/logos/.test(request.url)) { // отдавай лого из фолбека, если чел выбрал экономный режим
        event.respondWith(caches.match(fallbackImage));
    }
    }*/
    const currentCacheObj = Object.values(CURRENT_CACHES).find(curCache => request.url.match(curCache.path)) || CURRENT_CACHES.other // находит первое совпадение
    const CACHE_NAME = currentCacheObj.name // берем КЕШ, соотвествующий запросу


    event.respondWith(
        caches.match(request, { ignoreMethod: true })
        .then(resCached => {
            if (resCached) {
                log('fetching from SW . . . ', evt)
                return resCached
            }
            return fetch(request, { mode: 'no-cors', credentials: 'include' }) // если нет в кеше, берем из инета и кладем в кеш
                .then(resFresh => {
                    const resCloned = resFresh.clone();
                    // Check if we received a valid response
                    if (!resFresh || resFresh.status !== 200 /*|| resFresh.type !== 'basic'*/ ) { // the response type is basic, which indicates that it's a request from our origin. This means that requests to third party assets aren't cached as well.
                        return resFresh;
                    }
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            log('cache.put', request)
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

function onMessage(evt) {
    log('message', evt)
    if (evt.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
}





const onDownload = evt => log('onDownload', evt);
const onPush = evt => log('onPush', evt);
const onSync = evt => log('onSync', evt);

self.addEventListener('download', onDownload) // кажется нету такого!

// => functional events:
self.addEventListener('fetch', onFetch)
self.addEventListener('push', onPush)
self.addEventListener('sync', onSync)


// help functions // 
function log(msg, ...evt) {
    console.log(`[SW] ${CACHE_VERSION} ${msg}`, ...evt)
}

function expectedCacheKeys() {
    return Object.values(CURRENT_CACHES).map(({ name }) => name).filter(cacheKey => cacheKey.endsWith(CACHE_VERSION))
}