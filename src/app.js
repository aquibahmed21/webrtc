// app.js
import { getLocalStream, createVideoElement, toggleCamera } from './media.js';
import { setupRoom, pcInfo, drone } from './room.js';

export const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let localStream = null;

document.querySelector("#controls").addEventListener('click', async event => {
  const target = event.target;
  const targetID = event.target.id;
  switch (targetID) {
    case 'start':
      await main();
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
      await toggleCamera();

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
            pcInfo.close();
          }
        }, 300); // ~300ms delay
      }
      break;
  }
});

async function main() {
  localStream = await getLocalStream();
  createVideoElement(localStream, 'localVideo', true);

  setupRoom(localStream, (remoteStream, id) => {
    if (!document.getElementById(id)) {
      createVideoElement(remoteStream, id);
    }
  });
}

  if (!isMobile)
    document.querySelector('#switchCamera').style.display = 'none';