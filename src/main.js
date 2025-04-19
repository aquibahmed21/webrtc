import './style.css';

document.querySelector('#app').innerHTML = `
   <div class="Channel">
    <video id="remoteVideo" autoplay></video>
    <video id="localVideo" autoplay muted></video>
    </div>

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

let localstream = null;
let localheight = 0;
let localwidth = 0;
let localframeRate = 0;
// let settings = {};

document.addEventListener("DOMContentLoaded", async event => {
  await getMaxSupportedVideoConstraintsWithPermissions();
  // settings = JSON.parse(localStorage.getItem("configuration"));
  // const constraints = await navigator.mediaDevices.getSupportedConstraints();
  // console.log({ constraints });
});


const quality = document.querySelector('#quality');
const framerate = document.querySelector('#framerate');

const controls = document.querySelector('#controls');
controls.addEventListener('click', async event => {
  switch (event.target.id) {
    case 'start':
      {
        event.target.disabled = true;
        const [width, height] = quality.value.split('x').map(Number);
        const frameRate = Number(framerate.value);
        await updateStream(width, height, frameRate);
        localVideo.srcObject = localstream;
        localstream.getTracks().forEach(track => pc.addTrack(track, localstream));
        event.target.nextElementSibling.disabled = false;
        event.target.nextElementSibling.nextElementSibling.disabled = false;
        // if (settings.video.facingMode)
        //   event.target.nextElementSibling.nextElementSibling.nextElementSibling.disabled = false;
        event.target.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.disabled = false;
      }
      break;
    case 'muteAudio':
      event.target.textContent = localstream.getAudioTracks()[0].enabled ? 'Unmute Audio' : 'Mute Audio';
      localstream.getAudioTracks()[0].enabled = !localstream.getAudioTracks()[0].enabled;
      break;
    case 'muteVideo':
      event.target.textContent = localstream.getVideoTracks()[0].enabled ? 'Unmute Video' : 'Mute Video';
      localstream.getVideoTracks()[0].enabled = !localstream.getVideoTracks()[0].enabled;
      break;
    case 'switchCamera':
      const currentFacing = localstream.getVideoTracks()[0].getSettings().facingMode || 'user';
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
      localstream.getVideoTracks()[0].stop();
      localstream.removeTrack(localstream.getVideoTracks()[0]);
      localstream.addTrack(newStream.getVideoTracks()[0]);
      localstream = newStream;
      localVideo.srcObject = localstream;
      break;
    case 'hangup':
      localVideo.srcObject = null;
      localstream.getTracks().forEach(track => track.stop());
      localstream = null;
      event.target.disabled = true;
      event.target.previousElementSibling.disabled = true;
      event.target.previousElementSibling.previousElementSibling.disabled = true;
      event.target.previousElementSibling.previousElementSibling.previousElementSibling.disabled = true;
      event.target.previousElementSibling.previousElementSibling.previousElementSibling.previousElementSibling.disabled = false;
      break;
  }
});

async function getMediaStream(width, height, frameRate) {
  try {
    const constraints = {
      video: {
        width: { exact: width },
        height: { exact: height },
        frameRate: { exact: frameRate }
      },
      audio: true // adjust as needed
    };

    const newStream = await navigator.mediaDevices.getUserMedia(constraints);
    return newStream;
  } catch (error) {
    console.error("Failed to get media stream:", error);
    return null;
  }
}

async function updateStream(width, height, frameRate) {
  localheight = height;
  localwidth = width;
  localframeRate = frameRate;
  const newStream = await getMediaStream(width, height, frameRate);
  if (!newStream) return false;

  const newVideoTrack = newStream.getVideoTracks()[0];

  // Replace track in the existing stream
  if (localstream) {
    const oldTrack = localstream.getVideoTracks()[0];
    if (oldTrack) oldTrack.stop(); // stop the old track
    localstream.removeTrack(oldTrack);
    localstream.addTrack(newVideoTrack);
  } else {
    localstream = newStream;
  }
  return true;
}

quality.addEventListener('change', async event => {
  if (!localstream) return;
  const [width, height] = event.target.value.split('x').map(Number);
  if (!await updateStream(width, height, localframeRate)) return;

  // pc.getSenders().forEach(sender => {
  //   if (sender.track.kind == "video")
  //     sender.setTrackParameters({ 'maxWidth': width, 'maxHeight': height });
  // });
});
framerate.addEventListener('change', async event => {
  if (!localstream) return;
  const framerate = Number(event.target.value);
  if (!await updateStream(localwidth, localheight, framerate)) return;

  // pc.getSenders().forEach(sender => {
  //   if (sender.track.kind == "video")
  //   sender.setTrackParameters({ 'maxFramerate': framerate });
  // });
});

// Generate random room name if needed
if (!location.hash)
  location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);

const roomHash = location.hash.substring(1);

// TODO: Replace with your own channel ID
const drone = new ScaleDrone('EoIG3R1I4JdyS4L1');
// Room name needs to be prefixed with 'observable-'
const roomName = 'observable-' + roomHash;
const configuration = {
  iceServers: [{
    urls: 'stun:stun.l.google.com:19302'
  }]
};
let room;
let pc;


function onSuccess() { };
function onError(error) {
  console.error(error);
};

drone.on('open', error => {
  if (error) {
    return console.error(error);
  }
  room = drone.subscribe(roomName);
  room.on('open', error => {
    if (error) {
      onError(error);
    }
  });
  // We're connected to the room and received an array of 'members'
  // connected to the room (including us). Signaling server is ready.
  room.on('members', members => {
    console.log('MEMBERS', members);
    // If we are the second user to connect to the room we will be creating the offer
    const isOfferer = members.length === 2;
    startWebRTC(isOfferer);
  });
});

// Send signaling data via Scaledrone
function sendMessage(message) {
  drone.publish({
    room: roomName,
    message
  });
}

function startWebRTC(isOfferer) {
  pc = new RTCPeerConnection(configuration);

  // 'onicecandidate' notifies us whenever an ICE agent needs to deliver a
  // message to the other peer through the signaling server
  pc.onicecandidate = event => {
    if (event.candidate) {
      sendMessage({ 'candidate': event.candidate });
    }
  };

  // If user is offerer let the 'negotiationneeded' event create the offer
  if (isOfferer) {
    pc.onnegotiationneeded = () => {
      pc.createOffer().then(localDescCreated).catch(onError);
    };
  }

  // When a remote stream arrives display it in the #remoteVideo element
  pc.ontrack = event => {
    const stream = event.streams[0];
    if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
      remoteVideo.srcObject = stream;
      // for (const stream of event.streams)
      // {
      //   const existingVideo = document.querySelector(`video[data-stream-id="${stream.id}"]`);
      //   if (!existingVideo) {
      //     const newVideo = document.createElement('video');
      //     newVideo.srcObject = stream;
      //     newVideo.autoplay = true;
      //     newVideo.playsinline = true;
      //     newVideo.dataset.streamId = stream.id;
      //     document.querySelector('.dynamicVideoContainer').appendChild(newVideo);
      //   }
      // }
    };



    // Listen to signaling data from Scaledrone
    room.on('data', (message, client) => {
      // Message was sent by us
      if (client.id === drone.clientId) {
        return;
      }

      if (message.sdp) {
        // This is called after receiving an offer or answer from another peer
        pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
          // When receiving an offer lets answer it
          if (pc.remoteDescription.type === 'offer') {
            pc.createAnswer().then(localDescCreated).catch(onError);
          }
        }, onError);
      } else if (message.candidate) {
        // Add the new ICE candidate to our connections remote description
        pc.addIceCandidate(
          new RTCIceCandidate(message.candidate), onSuccess, onError
        );
      }
    });
  };

  function localDescCreated(desc) {
    pc.setLocalDescription(
      desc,
      () => sendMessage({ 'sdp': pc.localDescription }),
      onError
    );
  }

  async function getMaxSupportedVideoConstraintsWithPermissions() {
    try {
      const cameraPermission = await navigator.permissions.query({ name: 'camera' });
      const micPermission = await navigator.permissions.query({ name: 'microphone' });

      const cameraGranted = cameraPermission.state === 'granted';
      const micGranted = micPermission.state === 'granted';

      if (!cameraGranted || !micGranted) {
        console.log('Requesting permissions...');
        // Always call getUserMedia to access tracks and get capabilities
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });

        const videoTrack = stream.getVideoTracks()[0];
        const videoCapabilities = videoTrack.getCapabilities();

        const configuration = {
          video: {
            maxWidth: videoCapabilities.width?.max || 0,
            maxHeight: videoCapabilities.height?.max || 0,
            maxFrameRate: videoCapabilities.frameRate?.max || 0,
            facingMode: videoCapabilities.facingMode.toString(),
          },
          audio: true
        };
        localStorage.setItem("configuration", JSON.stringify(configuration));


        // Cleanup
        stream.getTracks().forEach(track => track.stop());
      }
      else {
        console.log('Permissions already granted.');
      }

      return;
    } catch (err) {
      console.error('Media access error or permission denied:', err);
      return null;
    }
  }
}
