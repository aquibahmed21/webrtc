
export let serviceWorkerMain = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load',
    async () => {
      const path = '/webrtc/service-worker.js';
      serviceWorkerMain = await navigator.serviceWorker.register(path)
        .catch(err => console.log('ServiceWorker registration failed:', err));
    });
}