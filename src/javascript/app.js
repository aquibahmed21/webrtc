// app.js
import { serviceWorkerMain } from './main.js';
import { getLocalStream, createVideoElement, switchCamera } from './media.js';
import { setupRoom, pcInfo, drone, manualReconnect, connectionStatus } from './room.js';
import { showToast } from './toast.js';
import { urlBase64ToUint8Array } from './util.js';
import { initializeTheme, createThemeSelector } from './theme.js';
import { initializeChat } from './chat.js';

export const isIos = /iphone|ipod|ipad/i.test(navigator.userAgent);
export const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let localStream = null;

const muteVideo = document.querySelector('#muteVideo');
const muteAudio = document.querySelector('#muteAudio');
const userInfoModal = document.querySelector('#userInfoModal');
const retryBtn = document.querySelector('#retryBtn');
const connectionStatusBar = document.querySelector('#connectionStatus');
const connectionStatusText = connectionStatusBar?.querySelector('.text');

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

// Connection status UI updates
if (connectionStatusBar) {
  connectionStatus.onChange = (status) => {
    connectionStatusBar.classList.remove('connected', 'reconnecting', 'disconnected');
    connectionStatusBar.classList.add(status);
    if (connectionStatusText) {
      if (status === 'connected') connectionStatusText.textContent = 'Connected';
      if (status === 'reconnecting') connectionStatusText.textContent = 'Reconnecting…';
      if (status === 'disconnected') connectionStatusText.textContent = 'Disconnected';
    }
  };
}

if (retryBtn) {
  retryBtn.addEventListener('click', () => {
    connectionStatus.set('reconnecting');
    manualReconnect();
  });
}

subscribeToPushNotification.addEventListener('click', async event => {
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
    headers: { 'Content-Type': 'application/json' },
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
  const { nickname, gender } = userInfo;
  if (!nickname || !gender)
    openModal();
}


document.querySelector("#audioOutputSelect").addEventListener('change', async () => {
  const selectedDeviceId = audioOutputSelect.value;
  const remoteVideos = document.querySelectorAll('video[isRemote]');
  try {
    for (const remoteVideo of remoteVideos) {
      if (typeof remoteVideo.setSinkId === 'function') {
        await remoteVideo.setSinkId(selectedDeviceId);
      }
    }
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

    audioOutputSelect.parentElement.style.display = audioOutputs.length <= 1 ? 'none' : '';
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
      muteVideo.textContent = "🎥 Mute Video";
      muteAudio.textContent = "🔇 Mute Audio";
      document.querySelector("#localMainVideo").classList.remove('active');
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.enabled = false;
        });
        setTimeout(() => {
          localStream.getTracks().forEach(track => track.stop());
          localStream = null;
          drone.publish({
            room: Object.keys(drone.rooms)[0],
            message: { type: 'leave', from: drone.clientId, userInfo }
          });
          document.querySelector(".Channel").innerHTML = "";
          if (pcInfo) {
            pcInfo.getSenders().forEach(sender => {
              if (sender.track) sender.track.stop();
            });
          }
        }, 300);
      }
      break;
  }
});

document.querySelector(".Channel").addEventListener('click', event => {
  if (event.target.tagName !== 'VIDEO') return;
  const mainVideo = document.getElementById('localMainVideo');
  mainVideo.srcObject = event.target.srcObject;
  mainVideo.classList.add('active');
  mainVideo.style.transform = (event.target.id === 'localVideo')? "scale(-1, 1)" : "";
});

document.querySelector("#localMainVideo").addEventListener("dblclick", event => {
  event.target.requestFullscreen();
});

async function main() {
  const nickname = JSON.parse(window.localStorage.getItem('userInfo'))?.nickname || "No name";
  SendPushToAll("Video Conferencing with KiteCite", "Started by " + nickname);
  localStream = await getLocalStream();
  createVideoElement(localStream, 'localVideo', true, "You");

  if (!isIos)
    setupAudioOutputSelection();

  if (drone) {
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

// Initialize theme system
initializeTheme();

// Add theme selector to controls
const themeSelector = createThemeSelector();
const controls = document.querySelector('.controls');
if (controls) {
  controls.insertAdjacentElement('afterend', themeSelector);
}

// Initialize chat system
initializeChat();

// Handle service worker messages (notification clicks)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
      // Handle notification click - could open chat, focus on specific room, etc.
      console.log('Notification clicked:', event.data.data);

      // Example: Open chat panel if notification was about a message
      if (event.data.data.type === 'chat') {
        const chatPanel = document.querySelector('.chat-panel');
        if (chatPanel) {
          chatPanel.classList.add('active');
          const chatInput = document.getElementById('chatInput');
          if (chatInput) {
            chatInput.focus();
          }
        }
      }

      // Example: Join specific room if notification was about a call
      if (event.data.data.type === 'call' && event.data.data.roomId) {
        // Navigate to specific room or show join dialog
        showToast('Info', `Incoming call to room: ${event.data.data.roomId}`);
      }
    }
  });
}

// Add to Home Screen
let deferredPrompt;
const installBtn = document.getElementById('install-btn');

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installBtn.style.display = 'flex';
  setTimeout(() => {
    installBtn.style.display = 'none';
    showToast('Info', 'You can add this app to your home screen!');
  }, 15000);
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
  installBtn.style.display = 'none';
}

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