// app.js
import { serviceWorkerMain } from './main.js';
import { getLocalStream, createVideoElement, switchCamera } from './media.js';
import { setupRoom, pcInfo, drone } from './room.js';
import { showToast } from './toast.js';
import { urlBase64ToUint8Array } from './util.js';

export const isIos = /iphone|ipod|ipad/i.test(navigator.userAgent);
export const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let localStream = null;

const muteVideo = document.querySelector('#muteVideo');
const muteAudio = document.querySelector('#muteAudio');
const userInfoModal = document.querySelector('#userInfoModal');

const serverURL = window.location.hostname === 'localhost' ? 'http://localhost:3000/' :
  'https://web-push-3zaz.onrender.com/';
const subscribeToPushNotification = document.querySelector('#push');



function SendPushToAll(title, body) {
  const initiator = JSON.parse(window.localStorage.getItem('userInfo'))?.id || 0;
  fetch(serverURL + 'notifyAll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initiator, title, body })
  });
}

async function IsSubscribedToPush () {
  const userInfo = JSON.parse(window.localStorage.getItem('userInfo'));
  if (!userInfo) return false;

  if (Notification.permission === 'granted')
  {
    const subscribe = localStorage.getItem('subscription')
    if (!subscribe)
    {
      const subscription = await serviceWorkerMain.pushManager.getSubscription();
      if (subscription)
      {
        await subscription.unsubscribe();
        showToast('Info', 'Notification unsubscribed locally!, Please resubscribe.');
      }
      return false
    }


    const res = await fetch(serverURL + 'isPushSubscribed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: subscribe
    });
    const json = await res.json();
    return json.isSubscribed;
  }
}


subscribeToPushNotification.addEventListener('click', async event => {
  // subscribeToPushNotification.setAttribute('disabled', 'true');
  const getVapidKey = await fetch(serverURL + "vapid").catch(err => console.log(err));
  if (!getVapidKey) return;
  const { publicKey } = await getVapidKey.json();
  subscribeToPushNotification.setAttribute('disabled', 'true');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    showToast('Error', 'Unable to subscribe to push notifications');
    subscribeToPushNotification.setAttribute('disabled', 'false');
    return;
  }

  const subscription = await serviceWorkerMain.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  });

  const subscribejson = {
    "endpoint": subscription.toJSON().endpoint,
    "expirationTime": subscription.toJSON().expirationTime,
    "keys": {
      "p256dh": subscription.toJSON().keys.p256dh,
      "auth": subscription.toJSON().keys.auth,
      "id": JSON.parse(window.localStorage.getItem('userInfo')).id
    }
  };

  localStorage.setItem('subscription', JSON.stringify(subscription));

  await fetch(serverURL + "subscribe", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(subscribejson)
  }).then(res => {
    if (res.status === 200)
      showToast('Success', 'Push notifications subscribed successfully');
    else
      showToast('Error', 'Unable to subscribe to push notifications');
  }).catch(err => {
    console.log(err);
    showToast('Error', 'Unable to subscribe to push notifications');
  });
  subscribeToPushNotification.style.display = 'none';
  showToast('Success', 'Push notifications subscribed successfully');
}, false);

setTimeout(async () => {
  const isSubscribed = await IsSubscribedToPush();
  subscribeToPushNotification.style.display = isSubscribed? 'none' : "";
}, 1000);

let userInfo = window.localStorage.getItem('userInfo');

if (!userInfo)
  openModal();
else {
  userInfo = JSON.parse(userInfo);
  const { nickname, gender, status, age } = userInfo;
  // ! check if all info is available
  if (!nickname || !gender)
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

document.querySelector(".Channel").addEventListener('click', event => {
  if (event.target.tagName !== 'VIDEO') return;
  const mainVideo = document.getElementById('localMainVideo');
  mainVideo.srcObject = event.target.srcObject;

    mainVideo.style.transform = (event.target.id === 'localVideo')? "scale(-1, 1)" : "";
});

async function main() {
  const nickname = JSON.parse(window.localStorage.getItem('userInfo'))?.nickname || "No name";
  SendPushToAll("Video Conferencing with KiteCite", "Started by " + nickname);
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
    const gender = document.querySelector('.radio-group').querySelector("input:checked").value;
    const status = document.querySelector('#status').value;
    const age = document.querySelector('#age').value;
    if (!nickname || !gender) {
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
    document.querySelector('.radio-group').querySelector("input[value=" + JSON.parse(userInfo).gender + "]").checked = true;
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
    document.querySelector('.radio-group').querySelector("input[value='male']").checked = true;
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