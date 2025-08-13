
export let serviceWorkerMain = null;
// Step 1: Ask for Permission
// if ('Notification' in window && 'serviceWorker' in navigator) {
//   Notification.requestPermission().then(permission => {
//     if (permission === 'granted') {
//       console.log('Push notifications granted');
//     }
//   });
// }

if ('serviceWorker' in navigator) {
  window.addEventListener('load',
    async () => {
      const path = '/webrtc/service-worker.js';
      serviceWorkerMain = await navigator.serviceWorker.register(path)
        .catch(err => console.log('ServiceWorker registration failed:', err));
    });
}

// window.addEventListener("beforeunload", function (event) {
//   // Standard for most browsers
//   const message = "Do you want to exit?";

//   // Some browsers require setting the returnValue property
//   event.returnValue = message; // Chrome, Firefox, etc.

//   // Older browsers might use the returnValue property to show a custom message
//   return message;  // For older browsers like Internet Explorer
// });