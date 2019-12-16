const scope = '/useful/konkurs-prognozov';
const wrapper = '#pwa-notification';
const button = '#sw-reload';

let offlineIcon;
let isOnline = ('onLine' in navigator) ? navigator.onLine : true;
const isLoggedIn = /isLoggedIn=1/.test(document.cookie.toString())
const usingSW = ('serviceWorker' in navigator)
let svcWorker;

initServiceWorker('/service-worker.js');



document.addEventListener('DOMContentLoaded', onReady, false)

navigator.serviceWorker.onmessage = onSWMessage

function onReady() {
    offlineIcon = document.querySelector('#connectivity-status')
    if (!isOnline) {
        offlineIcon.classList.remove('hidden')
    }

    window.addEventListener('online', function online() {
        offlineIcon.classList.add('hidden');
        isOnline = true;
        console.log('[reg sw] online');
    })

    window.addEventListener('offline', function online() {
        offlineIcon.classList.remove('hidden');
        isOnline = true;
        console.log('[reg sw] offline');
    })

}

async function initServiceWorker(path) {
    if (!usingSW) return console.warn("[SW] SW aren't supported.");

    await navigator.serviceWorker.register(path, {
            scope,
            updateViaCache: 'none'
        })
        .then(navigator.serviceWorker.ready)
        .then(regHandler)
        .catch(err => console.error('[SW] 🥺  register error =>', err))
}

function regHandler(newSW) {
    console.warn('[SW] 😀 registered! in scope', newSW.scope, newSW)
        // Do a one-off check to see if a service worker's in control.
    if (navigator.serviceWorker.controller) { console.warn(`[SW] This page is currently controlled by: ${navigator.serviceWorker.controller}`); } else { console.warn("[SW] This page isn't currently controlled by a SW."); }
    svcWorker = newSW.installing || newSW.waiting || newSW.active
    sendStatusUpdate(svcWorker);
    navigator.serviceWorker.oncontrollerchange = () => {
        svcWorker = navigator.serviceWorker.controller;
        sendStatusUpdate(svcWorker);
    }

    newSW.onupdatefound = () => {
        svcWorker = newSW.installing || newSW.waiting || newSW.active // An updated service worker has appeared in reg.installing!
        svcWorker.onstatechange = () => { // Has service worker state changed?
            console.warn('[SW] STATECHANGE => ', svcWorker.state)
            switch (svcWorker.state) {
                case 'installing':
                    break; // the install event has fired, but not yet complete
                case 'installed':
                    break; // install complete
                case 'activating':
                    break; // the activate event has fired, but not yet complete
                case 'activated': // fully active
                    if (!navigator.serviceWorker.controller) {
                        return console.error('[SW] controller is not in navigator.serviceWorker!')
                    }
                    showUpdateRequest(); // There is a new service worker available, show the notification
                    break;
                case 'redundant': // discarded. Either failed install, or it's been replaced by a newer version
                    hideUpdateRequest();
                    break;
            }
        };
    }
}

function skipWaiting(e) {
    e.preventDefault()
    svcWorker.postMessage({ action: 'skipWaiting' });
}

function showUpdateRequest() {
    document.querySelector('#sw-reload').onclick = skipWaiting; // The click event on the notification
    document.querySelector(wrapper).style.display = 'block';
}

function hideUpdateRequest() {
    document.querySelector(wrapper).style.display = 'none';
}


function onSWMessage(evt) {
    let { data } = evt
    if (data.requestStatusUpdate) {
        console.warn('[reg SW] => Received status update req from SW')
        sendStatusUpdate(evt.ports && evt.ports[0])
    }
}

function sendStatusUpdate(target) {
    sendSWMessage({ statusUpdate: { isOnline, isLoggedIn } }, target)
}

function sendSWMessage(msg, target) {
    if (target) {
        target.postMessage(msg)
    } else if (svcWorker) {
        svcWorker.postMessage(msg)
    } else {
        navigator.serviceWorker.controller.postMessage(msg)
    }
}