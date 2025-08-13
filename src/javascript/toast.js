// Function to create and display toast message
export function showToast(type, message) {
  const toastContainer = document.getElementById('toastContainer');

  // Create toast element
  const toast = document.createElement('div');
  toast.classList.add('toast', type.toLowerCase());
  toast.textContent = message;

  toastContainer.innerHTML = '';

  // Append toast to the container
  toastContainer.appendChild(toast);

  // Remove toast after the animation ends (3 seconds)
  setTimeout(() => {
    toast.remove();
  }, 3000);
}


// ! sample
// showToast('Info', 'This is an info message!')"
// showToast('Warning', 'This is a warning message!')"
// showToast('Error', 'This is an error message!')"