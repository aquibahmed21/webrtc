// app.ts
import { serviceWorkerMain } from './main.js';
import { getLocalStream, createVideoElement, switchCamera, switchToSelectedDevices, setSelectedDevices, getSelectedDevices } from './media.js';
import { setupRoom, pcInfo, drone, manualReconnect, connectionStatus, getPeerConnections, getPeerName } from './room.js';
import { showToast } from './toast.js';
import { urlBase64ToUint8Array } from './util.js';
import { initializeTheme, createThemeSelector } from './theme.js';
import { initializeChat } from './chat.js';
import { initializeUsersPanel } from './users.js';
import { initializeAudioOutput } from './audioOutput.js';
import { UserInfo } from '../types/index.js';

export const isIos = /iphone|ipod|ipad/i.test(navigator.userAgent);
export const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let localStream: MediaStream | null = null;

const muteVideo = document.querySelector('#muteVideo') as HTMLButtonElement;
const muteAudio = document.querySelector('#muteAudio') as HTMLButtonElement;
const userInfoModal = document.querySelector('#userInfoModal') as HTMLElement;
const retryBtn = document.querySelector('#retryBtn') as HTMLButtonElement;
const connectionStatusBar = document.querySelector('#connectionStatus') as HTMLElement;
const connectionStatusText = connectionStatusBar?.querySelector('.text') as HTMLElement;
let callStartMs: number | null = null;
let statsInterval: NodeJS.Timeout | null = null;
let statsVisible = true;
const pipToggleBtn = document.getElementById('pipToggle') as HTMLButtonElement;
const videoInputSelect = document.getElementById('videoInputSelect') as HTMLSelectElement;
const audioInputSelect = document.getElementById('audioInputSelect') as HTMLSelectElement;
// const videoDevicesRefresh = document.getElementById('videoDevicesRefresh') as HTMLButtonElement;
// const audioDevicesRefresh = document.getElementById('audioDevicesRefresh') as HTMLButtonElement;

const serverURL = window.location.hostname === 'localhost' ? 'http://localhost:3000/' :
  'https://web-push-3zaz.onrender.com/';
const subscribeToPushNotification = document.querySelector('#push') as HTMLButtonElement;

if (navigator.mediaDevices) {
  (async () => {
  // Attach change handlers for input selectors
  if (videoInputSelect) {
    videoInputSelect.addEventListener('change', async () => {
      const vid = videoInputSelect.value || '';
      const { audioDeviceId } = getSelectedDevices();
      setSelectedDevices({ videoDeviceId: vid });
      persistSelectedDevices();
      try { await switchToSelectedDevices(vid, audioDeviceId || ''); } catch (e) { console.warn(e); }
    });
  }
  if (audioInputSelect) {
    audioInputSelect.addEventListener('change', async () => {
      const aud = audioInputSelect.value || '';
      const { videoDeviceId } = getSelectedDevices();
      setSelectedDevices({ audioDeviceId: aud });
      persistSelectedDevices();
      try { await switchToSelectedDevices(videoDeviceId || '', aud); } catch (e) { console.warn(e); }
    });
  }
  })();
}

function SendPushToAll(title: string, body: string): void {
  try {
    if (!navigator.onLine) return;
    const initiator = JSON.parse(window.localStorage.getItem('userInfo') || '{}')?.id || 0;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    fetch(serverURL + 'notifyAll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initiator, title, body }),
      signal: controller.signal
    }).catch((err: any) => {
      console.warn('NotifyAll failed (ignored):', err?.message || err);
    }).finally(() => clearTimeout(timeout));
  } catch (e: any) {
    console.warn('NotifyAll threw (ignored):', e?.message || e);
  }
}

async function IsSubscribedToPush(): Promise<boolean> {
  const userInfo = JSON.parse(window.localStorage.getItem('userInfo') || '{}');
  if (!userInfo) return false;

  if (Notification.permission === 'granted') {
    const subscribe = localStorage.getItem('subscription');
    if (!subscribe) {
      const subscription = await serviceWorkerMain?.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        showToast('Info', 'Notification unsubscribed locally!, Please resubscribe.');
      }
      return false;
    }

    const res = await fetch(serverURL + 'isPushSubscribed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: subscribe
    });
    const json = await res.json();
    return json.isSubscribed;
  }
  return false;
}

// Connection status UI updates
if (connectionStatusBar) {
  connectionStatus.onChange = (status: 'connected' | 'reconnecting' | 'disconnected') => {
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

subscribeToPushNotification?.addEventListener('click', async () => {
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

  const subscription = await serviceWorkerMain?.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource
  });

  const subscribejson = {
    "endpoint": subscription?.toJSON().endpoint,
    "expirationTime": subscription?.toJSON().expirationTime,
    "keys": {
      "p256dh": subscription?.toJSON().keys?.p256dh,
      "auth": subscription?.toJSON().keys?.auth,
      "id": JSON.parse(window.localStorage.getItem('userInfo') || '{}').id
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
  }).catch((err: any) => {
    console.log(err);
    showToast('Error', 'Unable to subscribe to push notifications');
  });
  subscribeToPushNotification.style.display = 'none';
  showToast('Success', 'Push notifications subscribed successfully');
}, false);

setTimeout(async () => {
  const isSubscribed = await IsSubscribedToPush();
  if (subscribeToPushNotification) {
    subscribeToPushNotification.style.display = isSubscribed? 'none' : "";
  }
}, 1000);

let userInfo: UserInfo | null = JSON.parse(window.localStorage.getItem('userInfo') || 'null');

if (!userInfo) {
  openModal();
} else {
  const { nickname, gender } = userInfo;
  if (!nickname || !gender)
    openModal();
}

navigator.mediaDevices.addEventListener('devicechange', () => {
  populateDeviceSelectors();
});

async function populateDeviceSelectors(): Promise<void> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter(d => d.kind === 'videoinput');
    const audioInputs = devices.filter(d => d.kind === 'audioinput');

    // Populate cameras
    if (videoInputSelect) {
      const current = getSelectedDevices().videoDeviceId;
      videoInputSelect.innerHTML = '';
      videoInputs.forEach((d, idx) => {
        const option = document.createElement('option');
        option.value = d.deviceId;
        option.text = d.label || `Camera ${idx + 1}`;
        videoInputSelect.appendChild(option);
      });
      if (current && [...videoInputSelect.options].some(o => o.value === current)) {
        videoInputSelect.value = current;
      }
    }

    // Populate microphones
    if (audioInputSelect) {
      const current = getSelectedDevices().audioDeviceId;
      audioInputSelect.innerHTML = '';
      audioInputs.forEach((d, idx) => {
        const option = document.createElement('option');
        option.value = d.deviceId;
        option.text = d.label || `Microphone ${idx + 1}`;
        audioInputSelect.appendChild(option);
      });
      if (current && [...audioInputSelect.options].some(o => o.value === current)) {
        audioInputSelect.value = current;
      }
    }
  } catch (e) {
    console.error('Failed to populate device selectors', e);
  }
}

function persistSelectedDevices(): void {
  const vid = videoInputSelect?.value || '';
  const aud = audioInputSelect?.value || '';
  try { localStorage.setItem('selectedVideoDeviceId', vid); } catch {}
  try { localStorage.setItem('selectedAudioDeviceId', aud); } catch {}
}

function restoreSelectedDevices(): void {
  try {
    const vid = localStorage.getItem('selectedVideoDeviceId') || '';
    const aud = localStorage.getItem('selectedAudioDeviceId') || '';
    setSelectedDevices({ videoDeviceId: vid || null, audioDeviceId: aud || null });
  } catch {}
}

document.querySelector("#controls")?.addEventListener('click', async (event: Event) => {
  const target = event.target as HTMLElement;
  const targetID = target.id;
  switch (targetID) {
    case 'start':
      (target as HTMLButtonElement).disabled = true;
      await main();
      (target as HTMLButtonElement).disabled = false;
      break;
    case 'muteAudio':
      target.textContent = "🔇 " + (localStream?.getAudioTracks()[0].enabled ? 'Unmute Audio' : 'Mute Audio');
      localStream?.getAudioTracks()[0] && (localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled);
      break;
    case 'muteVideo':
      target.textContent = "🎥 " + (localStream?.getVideoTracks()[0].enabled ? 'Unmute Video' : 'Mute Video');
      localStream?.getVideoTracks()[0] && (localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled);
      break;
    case 'switchCamera':
      await switchCamera();
      break;
    case 'videoDevicesRefresh':
      populateDeviceSelectors();
      break;
    case 'audioDevicesRefresh':
      populateDeviceSelectors();
      break;
    case 'hangup':
      resetAfterHangup();
      break;
    case 'pipToggle':
      handlePiPToggle();
      break;
  }
});

document.querySelector(".Channel")?.addEventListener('click', (event: Event) => {
  const target = event.target as HTMLElement;
  if (target.tagName !== 'VIDEO') return;
  const mainVideo = document.getElementById('localMainVideo') as HTMLVideoElement;
  if (mainVideo.getAttribute("participantID") == target.id) return;
  mainVideo.setAttribute("participantID", target.id);
  const video = target as HTMLVideoElement;
  mainVideo.srcObject = video.srcObject;
  mainVideo.classList.add('active');
  mainVideo.style.transform = (video.id === 'localVideo')? "scale(-1, 1)" : "";
});

document.querySelector("#localMainVideo")?.addEventListener("dblclick", (event: Event) => {
  const target = event.target as HTMLVideoElement;
  target.requestFullscreen();
});

// Picture-in-Picture setup
if (pipToggleBtn) {
  // Feature detection and button visibility
  const pipSupported = 'pictureInPictureEnabled' in document && typeof HTMLVideoElement !== 'undefined' && 'requestPictureInPicture' in HTMLVideoElement.prototype;
  if (!pipSupported) {
    pipToggleBtn.style.display = 'none';
  } else {
    const mainVideo = document.getElementById('localMainVideo') as HTMLVideoElement;
    if (mainVideo) {
      mainVideo.addEventListener('enterpictureinpicture', () => {
        pipToggleBtn.textContent = '🗗 Exit PiP';
      });
      mainVideo.addEventListener('leavepictureinpicture', () => {
        pipToggleBtn.textContent = '🗔 Picture-in-Picture';
      });
    }
  }
}

async function handlePiPToggle(): Promise<void> {
  try {
    if (!('pictureInPictureEnabled' in document)) return;
    const mainVideo = document.getElementById('localMainVideo') as HTMLVideoElement;
    if (!mainVideo || !mainVideo.srcObject) return;

    // Ensure video is playing to enter PiP on some browsers
    if (mainVideo.paused) {
      try { await mainVideo.play(); } catch {}
    }

    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      return;
    }

    // If another element is in PiP, exit first
    if (document.pictureInPictureElement && document.pictureInPictureElement !== mainVideo) {
      await document.exitPictureInPicture();
    }

    await mainVideo.requestPictureInPicture();
  } catch (err) {
    console.error('PiP toggle failed:', err);
    showToast('Error', 'Unable to toggle Picture-in-Picture');
  }
}

async function main(): Promise<void> {
  const nickname = JSON.parse(window.localStorage.getItem('userInfo') || '{}').nickname || "No name";
  SendPushToAll("Video Conferencing with KiteCite", "Started by " + nickname);
  restoreSelectedDevices();
  localStream = await getLocalStream();
  if (localStream) {
    createVideoElement(localStream, 'localVideo', true, "You");
  }
  callStartMs = Date.now();
  startStatsPolling();

  if (!isIos) {
    await populateDeviceSelectors();
  }

  if (drone) {
    drone.publish({
      room: Object.keys(drone.rooms)[0],
      message: { type: 'join', from: drone.clientId, userInfo }
    });
    return;
  }

  if (localStream) {
    setupRoom(localStream, (remoteStream, id, name) => {
      if (!document.getElementById(id)) {
        createVideoElement(remoteStream, id, false, name);
      }
    });
  }
}

if (!isIos)
  populateDeviceSelectors();

if (!isMobile) {
  const switchCameraEl = document.querySelector('#switchCamera') as HTMLElement;
  if (switchCameraEl) switchCameraEl.style.display = 'none';
}

// Initialize theme system
initializeTheme();

// Add theme selector to controls
const themeSelector = createThemeSelector();
const controls = document.querySelector('.controls');
if (controls) {
  controls.insertAdjacentElement('afterend', themeSelector);
}
// Add stats toggle button next to PiP if available
const pipBtn = document.getElementById('pipToggle') || document.getElementById('shareScreen') || document.getElementById('hangup');
if (pipBtn) {
  const statsToggle = document.createElement('button');
  statsToggle.id = 'statsToggle';
  statsToggle.textContent = '📊 Stats';
  statsToggle.title = 'Show/Hide bitrate stats';
  pipBtn.parentNode?.insertBefore(statsToggle, pipBtn.nextSibling);
  statsToggle.addEventListener('click', () => {
    statsVisible = !statsVisible;
    const panel = document.getElementById('statsPanel');
    if (panel) panel.style.display = statsVisible ? '' : 'none';
  });
}

// Initialize chat system
initializeChat();

// Initialize users panel
initializeUsersPanel();

// Initialize audio output routing (speaker / earpiece / bluetooth / headphones)
initializeAudioOutput();

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
          const chatInput = document.getElementById('chatInput') as HTMLInputElement;
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
let deferredPrompt: any;
const installBtn = document.getElementById('install-btn') as HTMLButtonElement;

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
    deferredPrompt.userChoice.then((choiceResult: any) => {
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

userInfoModal?.addEventListener('click', (event: Event) => {
  const target = event.target as HTMLElement;
  if (target === userInfoModal || target.id === 'closeModal')
    closeModal();
  else if (target.id === 'submit-btn') {
    event.stopPropagation();
    const nickname = (document.querySelector('#nickname') as HTMLInputElement).value;
    const gender = (document.querySelector('#divGender') as HTMLElement).querySelector("input:checked") as HTMLInputElement;
    const status = (document.querySelector('#status') as HTMLInputElement).value;
    const age = (document.querySelector('#age') as HTMLInputElement).value;
    if (!nickname || !gender) {
      showToast('Error', 'Please fill all the fields!');
      return;
    }
    userInfo = { nickname, gender: gender.value as 'male' | 'female', status, age: parseInt(age), id: new Date().getTime() };
    window.localStorage.setItem('userInfo', JSON.stringify(userInfo));
    closeModal();
  }
});

function openModal(): void {
  userInfoModal?.classList.add("show-modal");
  const userInfo = window.localStorage.getItem('userInfo');
  const h4 = document.querySelector('h4') as HTMLElement;
  if (userInfo) {
    const parsed = JSON.parse(userInfo);
    (document.querySelector('#nickname') as HTMLInputElement).value = parsed.nickname;
    (document.querySelector('#divGender') as HTMLElement).querySelector(`input[value=${parsed.gender}]`) as HTMLInputElement;
    (document.querySelector('#status') as HTMLInputElement).value = parsed.status;
    (document.querySelector('#age') as HTMLInputElement).value = parsed.age;
    h4.innerHTML = "Video Conferencing with KiteCite";
  }
  else {
    (document.querySelector('#start') as HTMLButtonElement).setAttribute('disabled', 'true');
    h4.innerHTML = "Dear Anonymous User, Please Enter Your Details";
  }
}

function closeModal(): void {
  const userInfo = window.localStorage.getItem('userInfo');
  const h4 = document.querySelector('h4') as HTMLElement;
  userInfoModal?.classList.remove("show-modal");
  if (userInfo) {
    (document.querySelector('#nickname') as HTMLInputElement).value = "";
    (document.querySelector('#divGender') as HTMLElement).querySelector("input[value='male']") as HTMLInputElement;
    (document.querySelector('#status') as HTMLInputElement).value = "";
    (document.querySelector('#age') as HTMLInputElement).value = "";
    h4.innerHTML = "Video Conferencing with KiteCite";
    (document.querySelector('#start') as HTMLButtonElement).removeAttribute('disabled');
    h4.removeEventListener('click', openModal);
  }
  else {
    (document.querySelector('#start') as HTMLButtonElement).setAttribute('disabled', 'true');
    h4.innerHTML = "Dear Anonymous User, Please Enter Your Details By Clicking Here";
    h4.addEventListener('click', openModal);
  }
}

// ===== Call duration + Bitrate stats UI =====
let statsPanel: HTMLElement | null = null;
function ensureStatsPanel(): HTMLElement {
  if (statsPanel) return statsPanel;
  statsPanel = document.createElement('div');
  statsPanel.id = 'statsPanel';
  statsPanel.style.position = 'fixed';
  statsPanel.style.bottom = '10px';
  statsPanel.style.left = '10px';
  statsPanel.style.zIndex = '1001';
  statsPanel.style.background = 'var(--bg-card)';
  statsPanel.style.border = '1px solid var(--border-primary)';
  statsPanel.style.borderRadius = '8px';
  statsPanel.style.padding = '8px 10px';
  statsPanel.style.fontSize = '12px';
  statsPanel.style.maxWidth = '320px';
  statsPanel.innerHTML = `<div id="callDuration">Duration: 00:00</div><div id="overallStats"></div><div id="perPeerStats" style="margin-top:6px;"></div>`;
  document.body.appendChild(statsPanel);

  // Make draggable within viewport
  makeDraggable(statsPanel);
  return statsPanel;
}

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600).toString().padStart(2, '0');
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(total % 60).toString().padStart(2, '0');
  return (h === '00' ? `${m}:${s}` : `${h}:${m}:${s}`);
}

let lastStats: Record<string, { t: number; sent: number; recv: number }> = {};
let baseStats: Record<string, { sent: number; recv: number }> = {};
async function pollStatsOnce(): Promise<void> {
  try {
    ensureStatsPanel();
    if (callStartMs) {
      const cd = document.getElementById('callDuration');
      if (cd) cd.textContent = `Duration: ${formatDuration(Date.now() - callStartMs)}`;
    }

    const peers = getPeerConnections();
    let overallUpBps = 0, overallDownBps = 0;
    let overallSentBytes = 0, overallRecvBytes = 0;
    const perPeer: Array<{ peerId: string; upBps: number; downBps: number }> = [];

    const now = Date.now();
    const pcEntries = Object.entries(peers);
    for (const [peerId, pc] of pcEntries) {
      if (!pc || typeof pc.getStats !== 'function') continue;
      const stats = await pc.getStats();
      let bytesSent = 0, bytesRecv = 0;
      stats.forEach(report => {
        if (report.type === 'outbound-rtp' && !report.isRemote) {
          if (typeof report.bytesSent === 'number') bytesSent += report.bytesSent;
        }
        if (report.type === 'inbound-rtp' && !report.isRemote) {
          if (typeof report.bytesReceived === 'number') bytesRecv += report.bytesReceived;
        }
      });

      if (!baseStats[peerId]) baseStats[peerId] = { sent: bytesSent, recv: bytesRecv };

      const last = lastStats[peerId] || { t: now, sent: bytesSent, recv: bytesRecv };
      const dt = Math.max(1, now - last.t) / 1000; // seconds
      const upBps = Math.max(0, ((bytesSent - last.sent) * 8) / dt);
      const downBps = Math.max(0, ((bytesRecv - last.recv) * 8) / dt);
      lastStats[peerId] = { t: now, sent: bytesSent, recv: bytesRecv };

      overallUpBps += upBps;
      overallDownBps += downBps;
      overallSentBytes += Math.max(0, bytesSent - baseStats[peerId].sent);
      overallRecvBytes += Math.max(0, bytesRecv - baseStats[peerId].recv);
      perPeer.push({ peerId, upBps, downBps });
    }

    // Render
    const overall = document.getElementById('overallStats');
    if (overall) overall.textContent = `Total Up: ${formatBytes(overallSentBytes)} | Total Down: ${formatBytes(overallRecvBytes)}`;
    const per = document.getElementById('perPeerStats');
    if (per) per.innerHTML = perPeer.map(p => {
      const name = getPeerName(p.peerId) || p.peerId;
      return `<div>${escapeHtml(name)}: ↑ ${formatBps(p.upBps)} ↓ ${formatBps(p.downBps)}</div>`;
    }).join('');
  } catch (e) {
    // ignore errors during polling
  }
}

function formatBps(bps: number): string {
  if (!isFinite(bps)) return '0 bps';
  if (bps < 1000) return `${bps.toFixed(0)} bps`;
  if (bps < 1_000_000) return `${(bps/1000).toFixed(1)} Kbps`;
  if (bps < 1_000_000_000) return `${(bps/1_000_000).toFixed(1)} Mbps`;
  return `${(bps/1_000_000_000).toFixed(2)} Gbps`;
}

function formatBytes(bytes: number): string {
  if (!isFinite(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
  if (bytes < 1024*1024*1024) return `${(bytes/1024/1024).toFixed(1)} MB`;
  return `${(bytes/1024/1024/1024).toFixed(2)} GB`;
}

function startStatsPolling(): void {
  try {
    ensureStatsPanel();
    if (statsInterval) clearInterval(statsInterval);
    statsInterval = setInterval(pollStatsOnce, 1000);
  } catch {}
}

function stopStatsPolling(): void {
  try { if (statsInterval) clearInterval(statsInterval); } catch {}
  statsInterval = null;
  lastStats = {};
  baseStats = {};
}

function resetControlsUI(): void {
  try {
    // Reset toggle button labels
    if (muteVideo) muteVideo.textContent = '🎥 Mute Video';
    if (muteAudio) muteAudio.textContent = '🔇 Mute Audio';
    // Hide main video active state
    document.querySelector('#localMainVideo')?.classList.remove('active');
    // Clear channel grid
    const channel = document.querySelector('.Channel') as HTMLElement;
    if (channel) channel.innerHTML = '';
    // Reset device selectors to persisted defaults
    const { videoDeviceId, audioDeviceId } = getSelectedDevices();
    if (videoInputSelect && videoDeviceId) videoInputSelect.value = videoDeviceId;
    if (audioInputSelect && audioDeviceId) audioInputSelect.value = audioDeviceId;
    // Reset connection status bar
    if (connectionStatusBar) {
      connectionStatusBar.classList.remove('reconnecting', 'disconnected');
      connectionStatusBar.classList.add('connected');
      if (connectionStatusText) connectionStatusText.textContent = 'Connected';
    }
  } catch {}
}

async function resetAfterHangup(): Promise<void> {
  try {
    // Stop stats
    stopStatsPolling();
    // Stop and clear local stream
    try {
      if (localStream) {
        localStream.getTracks().forEach(track => {
          try { track.stop(); } catch {}
        });
      }
    } catch {}
    localStream = null;
    // Notify others you left
    try {
      if (drone && drone.rooms) {
        const roomName = Object.keys(drone.rooms)[0];
        drone.publish({ room: roomName, message: { type: 'leave', from: drone.clientId, userInfo } });
      }
    } catch {}
    // Stop outgoing senders
    try {
      if (pcInfo) {
        pcInfo.getSenders().forEach(sender => { try { sender.track?.stop(); } catch {} });
      }
    } catch {}
    // Tear down all peer connections and signalling
    try {
      const mod = await import('./room.js');
      if (typeof mod.destroyConnections === 'function') mod.destroyConnections();
    } catch {}
    // Reset UI
    resetControlsUI();
  } catch {}
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

// ===== Draggable helper =====
function makeDraggable(el: HTMLElement): void {
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const onDown = (clientX: number, clientY: number) => {
    const rect = el.getBoundingClientRect();
    dragging = true;
    offsetX = clientX - rect.left;
    offsetY = clientY - rect.top;
    // Switch to top/left positioning for free movement
    el.style.right = 'unset';
    el.style.bottom = 'unset';
    el.style.transform = 'none';
    document.body.style.userSelect = 'none';
  };

  const onMove = (clientX: number, clientY: number) => {
    if (!dragging) return;
    const maxX = window.innerWidth - el.offsetWidth - 4;
    const maxY = window.innerHeight - el.offsetHeight - 4;
    let x = Math.max(4, Math.min(clientX - offsetX, maxX));
    let y = Math.max(4, Math.min(clientY - offsetY, maxY));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  };

  const onUp = () => {
    dragging = false;
    document.body.style.userSelect = '';
  };

  el.style.cursor = 'move';
  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    onDown(e.clientX, e.clientY);
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', onUp);

  // Touch support
  el.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    onDown(t.clientX, t.clientY);
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    onMove(t.clientX, t.clientY);
  }, { passive: true });
  window.addEventListener('touchend', onUp);
}
