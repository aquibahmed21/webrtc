export function urlBase64ToUint8Array(base64String) {
  try {
    if (!base64String || typeof base64String !== 'string') {
      return new Uint8Array();
    }
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  } catch (e) {
    // Fallback to empty array on parsing errors
    return new Uint8Array();
  }
}