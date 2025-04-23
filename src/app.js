// app.js
import { getLocalStream, createVideoElement } from './media.js';
import { setupRoom } from './room.js';

import './style.css';

document.querySelector('#app').innerHTML = `
    <div class="Channel"></div>
    <div class="controls" id="controls">
      <button id="start">Start</button>
      <button id="muteAudio" disabled>Mute Audio</button>
      <button id="muteVideo" disabled>Mute Video</button>
      <button id="switchCamera" disabled>Switch Camera</button>
      <button id="hangup" disabled>Hang Up</button>
    </div>

    <label for="quality">Select quality:</label>
    <select id="quality">
      <option value="160x120">160x120</option>
      <option value="320x240">320x240</option>
      <option value="640x480">640x480</option>
      <option value="1280x720">1280x720</option>
      <option value="1920x1080">1920x1080</option>
    </select>

    <label for="framerate">Select framerate:</label>
    <select id="framerate">
      <option value="10">10</option>
      <option value="20">20</option>
      <option value="30">30</option>
      <option value="60">60</option>
    </select>

    <button id="refresh" onclick="location.reload()" title="Refresh page">&#x1f504;</button>
`;

let localStream = null;
async function main() {
  localStream = await getLocalStream();
  createVideoElement(localStream, 'localVideo', true);

  setupRoom(localStream, (remoteStream, id) => {
    if (!document.getElementById(id)) {
      createVideoElement(remoteStream, id);
    }
  });
}

document.querySelector("#controls").addEventListener('click', async event => {
  const target = event.target;
  const targetID = event.target.id;
  switch (targetID) {
    case 'start':
    {
      await main();
      target.disabled = true;
      target.nextElementSibling.disabled = false;
      target.nextElementSibling.nextElementSibling.disabled = false;
      // if (settings.video.facingMode)
      //   target.nextElementSibling.nextElementSibling.nextElementSibling.disabled = false;
      target.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.disabled = false;
    }
    case 'muteAudio':
      target.textContent = localStream.getAudioTracks()[0].enabled ? 'Unmute Audio' : 'Mute Audio';
      localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled;
      break;
    case 'muteVideo':
      target.textContent = localStream.getVideoTracks()[0].enabled ? 'Unmute Video' : 'Mute Video';
      localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled;
      break;
    case 'switchCamera':
      const currentFacing = localStream.getVideoTracks()[0].getSettings().facingMode || 'user';
      const newFacing = currentFacing === 'user' ? 'environment' : 'user';

      const constraints = {
        video: {
          width: localwidth,
          height: localheight,
          frameRate: localframeRate,
          facingMode: { ideal: newFacing }
        },
        audio: true
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      localStream.getVideoTracks()[0].stop();
      localStream.removeTrack(localStream.getVideoTracks()[0]);
      localStream.addTrack(newStream.getVideoTracks()[0]);
      localStream = newStream;
      createVideoElement(localStream, 'localVideo', true);
      break;
    case 'hangup':
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
      target.disabled = true;
      target.previousElementSibling.disabled = true;
      target.previousElementSibling.previousElementSibling.disabled = true;
      target.previousElementSibling.previousElementSibling.previousElementSibling.disabled = true;
      target.previousElementSibling.previousElementSibling.previousElementSibling.previousElementSibling.disabled = false;
      break;
  }
});