// app.js
import { getLocalStream, createVideoElement, switchCamera } from './media.js';
import { setupRoom, pcInfo, drone } from './room.js';

export const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let localStream = null;

document.querySelector("#audioOutputSelect").addEventListener('change', event => {
  const selectedDeviceId = audioOutputSelect.value;
  const remoteVideos = document.querySelectorAll('video:not(#localVideo)');
  try {
    remoteVideos.forEach(async remoteVideo => {
      await remoteVideo.setSinkId(selectedDeviceId);
    })
      console.log(`Audio output set to device: ${selectedDeviceId}`);
  } catch (err) {
      console.error('Error setting audio output device:', err);
  }
});

navigator.mediaDevices.addEventListener('devicechange', () => {
  setupAudioOutputSelection();
});

async function setupAudioOutputSelection() {
  const remoteVideos = document.querySelectorAll('video:not(#localVideo)');

  for (const remoteVideo of remoteVideos)
  {
    if (typeof remoteVideo.setSinkId === 'undefined') {
      console.log('Audio output device selection is not supported on this device.');
      return; // No sinkId support
    }
  }

  try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices.filter(device => device.kind === 'audiooutput');

      if (audioOutputs.length > 0) {

          audioOutputs.forEach(device => {
            if (audioOutputSelect.querySelector(`option[value="${device.deviceId}"]`)) return;
              const option = document.createElement('option');
              option.value = device.deviceId;
              option.text = device.label || `Speaker ${audioOutputSelect.length + 1}`;
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
      target.textContent = localStream.getAudioTracks()[0].enabled ? 'Unmute Audio' : 'Mute Audio';
      localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled;
      break;
    case 'muteVideo':
      target.textContent = localStream.getVideoTracks()[0].enabled ? 'Unmute Video' : 'Mute Video';
      localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled;
      break;
    case 'switchCamera':
      await switchCamera();
      break;
    case 'hangup':
      // Mute the local video and audio tracks before stopping
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
            message: { type: 'leave', from: drone.clientId }
          });

          document.querySelector(".Channel").innerHTML = "";

          if (pcInfo) {
            // Close peer connections and cleanup
            pcInfo.getSenders().forEach(sender => {
              if (sender.track) sender.track.stop();
            });
            // pcInfo.close();
          }
        }, 300); // ~300ms delay
      }
      break;
  }
});

async function main() {
  localStream = await getLocalStream();
  createVideoElement(localStream, 'localVideo', true);

  if (drone) {
    // Notify other peers you're joining
    drone.publish({
      room: Object.keys(drone.rooms)[0],
      message: { type: 'join', from: drone.clientId }
    });
    return;
  }

  setupRoom(localStream, (remoteStream, id) => {
    if (!document.getElementById(id)) {
      createVideoElement(remoteStream, id);
    }
  });
}

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
