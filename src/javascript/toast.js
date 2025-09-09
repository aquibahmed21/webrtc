// Function to create and display toast message
export function showToast(type, message) {
  try {
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
      // Create a container if missing
      toastContainer = document.createElement('div');
      toastContainer.id = 'toastContainer';
      document.body.appendChild(toastContainer);
    }

    const normalizedType = String(type || 'info').toLowerCase();
    const text = typeof message === 'string' ? message : JSON.stringify(message);

    // Create toast element
    const toast = document.createElement('div');
    toast.classList.add('toast');
    if (['info', 'warn', 'warning', 'error', 'success'].includes(normalizedType)) {
      toast.classList.add(normalizedType === 'warning' ? 'warn' : normalizedType);
    } else {
      toast.classList.add('info');
    }
    toast.textContent = text;

    // Clear previous toast for simplicity (single visible toast)
    toastContainer.innerHTML = '';

    // Append toast to the container
    toastContainer.appendChild(toast);

    // Remove toast after the animation ends (3 seconds)
    setTimeout(() => {
      try { toast.remove(); } catch {}
    }, 3000);
  } catch (e) {
    // As a last resort, log to console to avoid throwing from UI layer
    // eslint-disable-next-line no-console
    console.error('showToast failed:', e);
  }
}

// ! sample
// showToast('Info', 'This is an info message!')
// showToast('Warning', 'This is a warning message!')
// showToast('Error', 'This is an error message!')