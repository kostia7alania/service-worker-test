const scope = '/useful/konkurs-prognozov';
const wrapper = '#pwa-notification';
const button = '#sw-reload';
let newWorker;

if ('serviceWorker' in window.navigator) {
    window.onload = loadHandler;
} else {
    console.warn("[SW] SW aren't supported.");
}

// The event listener that is fired when the service worker updates
// Here we reload the page
navigator.serviceWorker.oncontrollerchange = oncontrollerchange

function loadHandler() {
    document.querySelector('#sw-reload').onclick = skipWaiting; // The click event on the notification
    navigator.serviceWorker.register('/service-worker.js', { scope })
        .then(navigator.serviceWorker.ready)
        .then(regHandler)
        .catch(err => console.error('[SW] 🥺  register error =>', err))
}


let refreshing;
function oncontrollerchange() {
    if (!refreshing) return;
    window.location.reload();
    refreshing = true;
}

function regHandler(reg) {
    console.warn('[SW] 😀 registered! in scope', reg.scope, reg)

    // Do a one-off check to see if a service worker's in control.
    if (navigator.serviceWorker.controller) {
        console.warn(`[SW] This page is currently controlled by: ${navigator.serviceWorker.controller}`);
    } else {
        console.warn("[SW] This page isn't currently controlled by a SW.");
    }

    reg.onupdatefound = () => {
        newWorker = reg.installing // An updated service worker has appeared in reg.installing!
        newWorker.onstatechange = () => { // Has service worker state changed?
            console.warn('[SW] STATECHANGE => ', newWorker.state)
            switch (newWorker.state) {
                case 'installing': break; // the install event has fired, but not yet complete
                case 'installed': break; // install complete
                case 'activating': break; // the activate event has fired, but not yet complete
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
    newWorker.postMessage({ action: 'skipWaiting' });
}

function showUpdateRequest() {
    document.querySelector(wrapper).style.display = 'block';
}
function hideUpdateRequest() {
    document.querySelector(wrapper).style.display = 'none';
}
