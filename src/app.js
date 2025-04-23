// app.js
import { getLocalStream, createVideoElement, getCameraList } from './media.js';
import { setupRoom, pcInfo } from './room.js';

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
      document.querySelector( ".Channel" ).innerHTML = "";
      pcInfo.getSenders().forEach(sender => {
        if (sender.track) {
          sender.track.stop();
        }
      } );
      pcInfo.close();
      break;
  }
} );

async function main ()
{
  localStream = await getLocalStream();
  createVideoElement(localStream, 'localVideo', true);

  setupRoom(localStream, (remoteStream, id) => {
    if (!document.getElementById(id)) {
      createVideoElement(remoteStream, id);
    }
  });
}

getCameraList().then( e =>
{
  if ( e.length <= 1 )
    document.querySelector( '#switchCamera' ).style.display = 'none';
})