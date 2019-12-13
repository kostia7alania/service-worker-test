const wrapper = '#pwa-notification';
const button = '#sw-reload'
let newWorker;

if ('serviceWorker' in window.navigator) {
    window.addEventListener('load', () => {

        // The click event on the notification
        document.querySelector('#sw-reload').addEventListener('click', e => {
            e.preventDefault()
            newWorker.postMessage({ action: 'skipWaiting' });
        });

        navigator.serviceWorker.register('/service-worker.js', { scope: '/useful/konkurs-prognozov' })
            .then(reg => {
                console.warn('[SW] 😀 registered! in scope', reg.scope, reg)
                reg.addEventListener('updatefound', () => {
                    alert('UPD  FOUND!')
                    // An updated service worker has appeared in reg.installing!
                    newWorker = reg.installing;
                    newWorker.onstatechange = () => {
                        console.warn('[SW]  , STATECHANGE = > ', newWorker.state)
                        // Has service worker state changed?
                        switch (newWorker.state) {
                            case 'activated':
                                // There is a new service worker available, show the notification
                                if (navigator.serviceWorker.controller) {
                                    const notification = document.querySelector(wrapper);
                                    notification.style.display = 'block';
                                }
                                break;
                            case 'installed':
                                console.log('INSTALLED !')
                        }
                        // debugger
                        const notification = document.querySelector(wrapper);
                        notification.style.display = 'block';
                    };
                });
            })
            .catch(err => console.warn('[SW] 🥺  register error =>', err))
    })
}

let refreshing;
// The event listener that is fired when the service worker updates
// Here we reload the page
navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    window.location.reload();
    refreshing = true;
});
