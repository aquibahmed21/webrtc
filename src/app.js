// app.js
import { getLocalStream, createVideoElement, switchCamera } from './media.js';
import { setupRoom, pcInfo, drone } from './room.js';
import { showToast } from './toast.js';

const isIos = /iphone|ipod|ipad/i.test(navigator.userAgent);
export const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let localStream = null;

const muteVideo = document.querySelector('#muteVideo');
const muteAudio = document.querySelector('#muteAudio');
const userInfoModal = document.querySelector('#userInfoModal');

const serverURL = window.location.hostname === 'localhost' ? 'http://localhost:3000/' :
                                                             'https://web-push-3zaz.onrender.com/';
const subscribeToPushNotification = document.querySelector('#push');

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64); const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

subscribeToPushNotification.addEventListener('click', async event => {
  subscribeToPushNotification.setAttribute('disabled', 'true');
  const getVapidKey = await fetch(serverURL + "vapid").catch(err => console.log(err));
  if (!getVapidKey) return;
  const { publicKey } = await getVapidKey.json();
  let path = "/webrtc/" + 'service-worker.js';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    showToast('Error', 'Unable to subscribe to push notifications');
    return;
  }
  const registration = await navigator.serviceWorker.register(path);
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  });
  await fetch(serverURL + "subscribe", {
    method: 'POST',
    body: JSON.stringify(subscription),
    headers: { 'Content-Type': 'application/json' }
  });
  subscribeToPushNotification.style.display = 'none';
  showToast('Success', 'Push notifications subscribed successfully');
});

if (Notification.permission === 'granted')
  subscribeToPushNotification.style.display = 'none';

let userInfo = window.localStorage.getItem('userInfo');

if (!userInfo)
  openModal();
else {
  userInfo = JSON.parse(userInfo);
  const { nickname, gender, status, age } = userInfo;
  // ! check if all info is available
  if (!nickname || !gender || !status || !age)
    openModal();
}


document.querySelector("#audioOutputSelect").addEventListener('change', event => {
  const selectedDeviceId = audioOutputSelect.value;
  const remoteVideos = document.querySelectorAll('video[isRemote]');
  try {
    remoteVideos.forEach(async remoteVideo => {
      await remoteVideo.setSinkId(selectedDeviceId);
    });
    console.log(`Audio output set to device: ${selectedDeviceId}`);
  } catch (err) {
    console.error('Error setting audio output device:', err);
  }
});

navigator.mediaDevices.addEventListener('devicechange', () => {
  setupAudioOutputSelection();
});

async function setupAudioOutputSelection() {

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioOutputs = devices.filter(device => device.kind === 'audiooutput' || device.label.includes("headset"));

    if (audioOutputs.length > 0) {
      audioOutputs.forEach(device => {
        if (audioOutputSelect.querySelector(`option[value="${device.deviceId}"]`)) return;
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || device.kind || `Speaker ${audioOutputSelect.length + 1}`;
        audioOutputSelect.appendChild(option);
      });
    }
  } catch (err) {
    console.error('Error fetching audio output devices:', err);
  }
}

document.querySelector("#controls").addEventListener('click', async event => {
  const target = event.target;
  const targetID = event.target.id;
  switch (targetID) {
    case 'start':
      target.disabled = true;
      await main();
      target.disabled = false;
      break;
    case 'muteAudio':
      target.textContent = "🔇 " + (localStream.getAudioTracks()[0].enabled ? 'Unmute Audio' : 'Mute Audio');
      localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled;
      break;
    case 'muteVideo':
      target.textContent = "🎥 " + (localStream.getVideoTracks()[0].enabled ? 'Unmute Video' : 'Mute Video');
      localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled;
      break;
    case 'switchCamera':
      await switchCamera();
      break;
    case 'audioOutputRefresh':
      setupAudioOutputSelection();
      break;
    case 'hangup':
      // Mute the local video and audio tracks before stopping
      muteVideo.textContent = "🎥 Mute Video";
      muteAudio.textContent = "🔇 Mute Audio";
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.enabled = false; // Mute the track
        });

        // Add a short delay to ensure mute is applied before stop
        setTimeout(() => {
          localStream.getTracks().forEach(track => track.stop());
          localStream = null;

          // Notify other peers you're leaving
          drone.publish({
            room: Object.keys(drone.rooms)[0],
            message: { type: 'leave', from: drone.clientId, userInfo }
          });

          document.querySelector(".Channel").innerHTML = "";

          if (pcInfo) {
            // Close peer connections and cleanup
            pcInfo.getSenders().forEach(sender => {
              if (sender.track) sender.track.stop();
            });
          }
        }, 300); // ~300ms delay
      }
      break;
  }
});

async function main() {
  localStream = await getLocalStream();
  createVideoElement(localStream, 'localVideo', true, "You");

  if (!isIos)
    setupAudioOutputSelection();

  if (drone) {
    // Notify other peers you're joining
    drone.publish({
      room: Object.keys(drone.rooms)[0],
      message: { type: 'join', from: drone.clientId, userInfo }
    });
    return;
  }

  setupRoom(localStream, (remoteStream, id, name) => {
    if (!document.getElementById(id)) {
      createVideoElement(remoteStream, id, false, name);
    }
  });
}

if (!isIos)
  setupAudioOutputSelection();

if (!isMobile)
  document.querySelector('#switchCamera').style.display = 'none';

// ! Add to Home Screen
let deferredPrompt;
const installBtn = document.getElementById('install-btn');

// Listen for the `beforeinstallprompt` event to show the A2HS button
window.addEventListener('beforeinstallprompt', (event) => {
  // Prevent the mini-info bar from appearing
  event.preventDefault();
  deferredPrompt = event;

  // Show the A2HS button when the event is fired
  installBtn.style.display = 'flex';
  setTimeout(() => {
    installBtn.style.display = 'none';
    showToast('Info', 'You can add this app to your home screen!');
  }, 15000);

  // Handle the click event to prompt the installation
  installBtn.addEventListener('click', () => {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the A2HS prompt');
      } else {
        console.log('User dismissed the A2HS prompt');
      }
      deferredPrompt = null;
    });
  });
});

if (window.matchMedia('(display-mode: standalone)').matches) {
  installBtn.style.display = 'none'; // Hide the button if the app is already installed
}
// ! Add to Home Screen end

userInfoModal.addEventListener('click', event => {

  if (event.target === userInfoModal || event.target.id === 'closeModal')
    closeModal();
  else if (event.target.id === 'submit-btn') {
    event.stopPropagation();
    const nickname = document.querySelector('#nickname').value;
    const gender = document.querySelector('#gender').value;
    const status = document.querySelector('#status').value;
    const age = document.querySelector('#age').value;
    if (!nickname || !gender || !status || !age) {
      showToast('Error', 'Please fill all the fields!');
      return;
    }
    userInfo = { nickname, gender, status, age, id: new Date().getTime() };
    window.localStorage.setItem('userInfo', JSON.stringify(userInfo));
    closeModal();
  }
});

// Open the modal
function openModal() {
  userInfoModal.classList.add("show-modal");
  const userInfo = window.localStorage.getItem('userInfo');
  const h4 = document.querySelector('h4');
  if (userInfo) {
    document.querySelector('#nickname').value = JSON.parse(userInfo).nickname;
    document.querySelector('#gender').value = JSON.parse(userInfo).gender;
    document.querySelector('#status').value = JSON.parse(userInfo).status;
    document.querySelector('#age').value = JSON.parse(userInfo).age;
    h4.innerHTML = "Video Conferencing with KiteCite";
  }
  else {
    document.querySelector('#start').setAttribute('disabled', true);
    h4.innerHTML = "Dear Anonymous User, Please Enter Your Details";
  }
}

// Close the modal
function closeModal() {
  const userInfo = window.localStorage.getItem('userInfo');
  const h4 = document.querySelector('h4');
  userInfoModal.classList.remove("show-modal");
  if (userInfo) {
    document.querySelector('#nickname').value = "";
    document.querySelector('#gender').value = "";
    document.querySelector('#status').value = "";
    document.querySelector('#age').value = "";
    h4.innerHTML = "Video Conferencing with KiteCite";
    document.querySelector('#start').removeAttribute('disabled');
    h4.removeEventListener('click', openModal);
  }
  else {
    document.querySelector('#start').setAttribute('disabled', true);
    h4.innerHTML = "Dear Anonymous User, Please Enter Your Details By Clicking Here";
    h4.addEventListener('click', openModal);
  }
}