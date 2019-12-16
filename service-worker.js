const CACHE_VERSION = '6.2.2';

const CURRENT_CACHES = {
    core: {
        name: `core-cache-v-${CACHE_VERSION}`,
        path: null,
        limit: 100,
        fallback: '',
    },
    js: {
        name: `js-cache-v-${CACHE_VERSION}`,
        path: /\/(_nuxt|scripts)\/.*\.js/i,
        limit: 100,
        fallback: '',
    },
    css: {
        name: `css-cache-v-${CACHE_VERSION}`,
        path: /\/_nuxt\/.*\.css/i,
        limit: 100,
        fallback: '',
    },
    img: {
        name: `img-cache-v-${CACHE_VERSION}`,
        path: /.*\.(svg|png|gif|ico|webp|wbmp|bmp|jpg|jpeg|jpe|tiff|jtiff)$/i,
        limit: 100,
        fallback: '/img/pwa/fallback/fallbackImage.svg',
    },
    fonts: {
        name: `fonts-cache-v-${CACHE_VERSION}`,
        path: /.*\.(WOFF2|WOFF|EOT|TTF)$/i,
        limit: 100,
        fallback: '',
    },
    other: {
        name: `other-cache-v-${CACHE_VERSION}`,
        path: /^https{0,1}:.*(moex\.com|localhost)\/.*/i, // все остальные запросы к нашему домену
        limit: 100,
        fallback: '/offline.html',
    }
};

const WHITE_LIST = [
    'api-marketplace.moex.com',
    'mpinv.beta.moex.com',
    'place.moex.com',
    //'develop.api.place.t2.beta.moex.com',
    'localhost'
];

const BLACK_LIST = [
    '__webpack_hmr'
];

const fallbacks = Object.values(CURRENT_CACHES).reduce((a, { fallback = "" }) => { a.add(fallback); return a }, new Set())

const CORE_CACHES = [
    './',
    ...fallbacks
];

self.addEventListener('install', onInstall);
self.addEventListener('activate', onActivate)
self.addEventListener('fetch', onFetch)
self.addEventListener('message', onMessage);
self.addEventListener('push', onPush)
self.addEventListener('sync', onSync)



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
                return cache.addAll(CORE_CACHES) // добавляем в кеш обязательные ресурсы
            })
    )
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


function onFetch(evt) {
    //caches.match(evt.request).then(res => res || fetch(e.request)) // CACHE FIRST
    const request = evt.request
    //const url = new URL(evt.request.url);
    const currentDomain = getHostName(request.url)
    if (request.method !== 'GET' ||
        //url.origin !== location.origin || // same-origin
        !WHITE_LIST.find(domain => domain === currentDomain) ||
        BLACK_LIST.find(item => request.url.match(item))) {
        log('fetch skipped', request)
        return;
    }
    /*const { saveData } = navigator.connection || {}
    // отправляет ли браузер в запросах заголовок Save-Data.
    if (saveData) { // в экономном режиме, для экономии, всегда отдавай фоллбек
    if (/img\/logos/.test(request.url)) { // отдавай лого из фолбека, если чел выбрал экономный режим
        evt.respondWith(caches.match(CURRENT_CACHES.img.fallback));
    }
    }*/
    const DYNAMIC_CACHE_OBJ = Object.values(CURRENT_CACHES).find(curCache => request.url.match(curCache.path)) || CURRENT_CACHES.other // находит первое совпадение
    const DYNAMIC_CACHE_NAME = DYNAMIC_CACHE_OBJ.name // берем КЕШ, соотвествующий запросу

    evt.respondWith(
        caches.match(request, { ignoreMethod: true })
            .then(resCached => {
                if (resCached) {
                    log('fetching from SW . . . ', evt)
                    return resCached
                }
                return fetch(request, { /*mode: 'no-cors',*/ credentials: 'include' }) // если нет в кеше, берем из инета и кладем в кеш
                    .then(resFresh => {
                        const resCloned = resFresh.clone();
                        // Check if we received a valid response
                        if (!resFresh || resFresh.status !== 200 /*|| resFresh.type !== 'basic'*/) { // the response type is basic, which indicates that it's a request from our origin. This means that requests to third party assets aren't cached as well.
                            return resFresh;
                        }
                        caches.open(DYNAMIC_CACHE_NAME)
                            .then(cache => {
                                log('cache.put', request)
                                cache.put(request, resCloned);
                            });
                        return resFresh
                    })
            })
            .catch(err => {

                const res = caches.open(DYNAMIC_CACHE_NAME).then(cache => cache.match(DYNAMIC_CACHE_OBJ.fallback) || err);
                debugger
                return res;
                // if (request.headers.get("Accept") === "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3") { // fallback for images
                //   return caches.open(CURRENT_CACHES.other.name).then(cache => cache.match(CURRENT_CACHES.other.fallback)); // запрос HTML-страницы
                //  }
                /*
                if (request.headers.get("Accept").includes('image')) { // fallback for images
                  return caches.match(CURRENT_CACHES.img.fallback)
                }
                */
            })
    )
}


// ************** help functions ************ //

function onMessage(evt) {
    log('message', evt)
    if (evt.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
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

function log(msg, ...evt) {
    console.log(`[SW] ${CACHE_VERSION} ${msg}`, ...evt)
}

function expectedCacheKeys() {
    return Object.values(CURRENT_CACHES).map(({ name }) => name).filter(cacheKey => cacheKey.endsWith(CACHE_VERSION))
}

function getHostName(url) {
    var match = url.match(/:\/\/(www[0-9]?\.)?(.[^/:]+)/i);
    if (match != null && match.length > 2 && typeof match[2] === 'string' && match[2].length > 0) {
        return match[2];
    }
    else {
        return null;
    }
}


function onPush(evt) { log('onPush', evt); }
function onSync(evt) { log('onSync', evt); }
