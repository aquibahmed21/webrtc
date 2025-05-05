import { pcInfo, drone } from './room.js';
import { showToast } from './toast.js';

const userInfo = JSON.parse(window.localStorage.getItem('userInfo'));

let localwidth = 0;
let localheight = 0;
let localstream = null;
let localframeRate = 0;
let localfacingMode = 'user';

const quality = document.querySelector('#quality');
const framerate = document.querySelector('#framerate');
const screenShare = document.querySelector('#shareScreen');
const muteVideo = document.querySelector('#muteVideo');
const switchCamerabutton = document.querySelector('#switchCamera');


quality.addEventListener('change', async event => {
  if (!localstream) return;
  const [width, height] = event.target.value.split('x').map(Number);
  if (!await updateStream(width, height, localframeRate)) return;
});

framerate.addEventListener('change', async event => {
  if (!localstream) return;

  const framerate = Number(event.target.value);
  if (!await updateStream(localwidth, localheight, framerate)) return;
});

screenShare.addEventListener('click', async event => {
  const localVideo = document.querySelector("#localVideo");
  event.target.setAttribute('disabled', 'true');
  if (event.target.getAttribute('isShared') === 'true') {
    event.target.textContent = '🖥️ Share Screen';
    event.target.setAttribute('isShared', 'false');
    muteVideo.removeAttribute('disabled');
    quality.removeAttribute('disabled');
    framerate.removeAttribute('disabled');
    switchCamerabutton.removeAttribute('disabled');
    event.target.removeAttribute('disabled');
    localVideo.removeAttribute('screenShare');
    await updateStream(localwidth, localheight, localframeRate);
    drone.publish({ room: Object.keys(drone.rooms)[0], message: { type: 'screenShare', from: drone.clientId, isShared: false, userInfo } });
    return;
  }

  if (!localstream) return;

  try {
    // 1. Capture screen
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        mediaSource: 'screen' // Can be 'screen' or 'window' depending on the browser
      }
    });

    event.target.textContent = '🖥️ Stop Sharing';
    event.target.setAttribute('isShared', 'true');
    muteVideo.setAttribute('disabled', 'true');
    quality.setAttribute('disabled', 'true');
    framerate.setAttribute('disabled', 'true');
    switchCamerabutton.setAttribute('disabled', 'true');
    localVideo.setAttribute('screenShare', 'true');

    if (localstream) {
      localstream.getVideoTracks()[0].stop();
      localstream.removeTrack(localstream.getVideoTracks()[0]);
    }

    // 2. Replace local video track
    const videoTrack = screenStream.getVideoTracks()[0];
    localstream.addTrack(videoTrack);
    await updateLocalVideoStream();
    drone.publish({ room: Object.keys(drone.rooms)[0], message: { type: 'screenShare', from: drone.clientId, isShared: true, userInfo } });
  } catch (err) {
    console.error('Error starting screen share:', err);
  }
  finally {
    event.target.removeAttribute('disabled');
  }
});

async function getMediaStream(width, height, frameRate, newFacing) {

  if (localstream) {
    localstream.getVideoTracks()[0].stop();
    localstream.removeTrack(localstream.getVideoTracks()[0]);
  }
  try {
    const constraints = {
      video: {
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: frameRate },
        facingMode: {
          ideal: newFacing
        }
      },
      audio: localstream ? false : true // adjust as needed
    };

    const newStream = await navigator.mediaDevices.getUserMedia(constraints);
    return newStream;
  } catch (error) {
    console.error("Failed to get media stream:", error);
    showToast('Error', 'Failed to get media stream!');
    return null;
  }
}

async function updateStream(width, height, frameRate, isLocal = false, isToggle = false) {
  localheight = height;
  localwidth = width;
  localframeRate = frameRate;

  const currentFacing = isToggle ? (localstream.getVideoTracks()[0].getSettings().facingMode || 'user') : 'user';
  localfacingMode = isToggle ? (currentFacing === 'user' ? 'environment' : 'user') : localfacingMode;

  const newStream = await getMediaStream(localwidth, localheight, localframeRate, localfacingMode);
  if (!newStream) return false;

  const newVideoTrack = newStream.getVideoTracks()[0];

  // Replace track in the existing stream
  if (localstream) {
    const oldTrack = localstream.getVideoTracks()[0];
    if (oldTrack) {
      oldTrack.stop(); // stop the old track
      localstream.removeTrack(oldTrack);
    }

    localstream.addTrack(newVideoTrack);
  } else {
    localstream = newStream;
  }
  if (isLocal) {
    const video = document.querySelector("#localVideo");
    video.setAttribute("mode", localstream.getVideoTracks()[0].getSettings().facingMode || 'user');
    video.srcObject = localstream;
  };
  await updateLocalVideoStream();
  return true;
}

export function switchCamera() {
  updateStream(localwidth, localheight, localframeRate, true, true);
}

// media.js
export async function getLocalStream() {
  const [width, height] = quality.value.split('x').map(Number);
  const frameRate = Number(framerate.value);
  await updateStream(width, height, frameRate);
  return localstream;
}

export function createVideoElement(stream, id, isLocal = false) {
  const video = document.createElement('video');
  video.srcObject = stream;
  video.id = id;
  video.autoplay = true;
  video.playsInline = true;

  video.setAttribute("memberId", id);

  if (isLocal) {
    video.muted = true;
    document.getElementsByClassName("Channel")[0].appendChild(video);
    video.setAttribute("mode", localstream.getVideoTracks()[0].getSettings().facingMode || 'user');
  }
  else {
    video.setAttribute("isRemote", "true");
    document.getElementsByClassName("Channel")[0].prepend(video);
    handleIncomingStream(stream, video);
  }
}

function handleIncomingStream(stream, video) {
  const threshold = 20;  // Adjust this threshold based on testing
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);

  const gainNode = audioContext.createGain();

  // Boost the gain
  gainNode.gain.value = 2.5; // 1.0 is normal, 2.0 is double volume, 3.0 is triple volume

  // Create AnalyserNode for frequency data analysis
  const analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 256;  // Set FFT size
  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  // Connect the microphone to the analyser
  source.connect(analyserNode);

  source.connect(gainNode).connect(audioContext.destination);

  video.srcObject = stream;
  video.volume = 0; // mute video element to avoid double audio
  let isSpeaking = false;  // State to keep track of the speaking status
  // Monitor audio levels periodically
  setInterval(() => {
    analyserNode.getByteFrequencyData(dataArray);  // Get frequency data

    // Calculate the total energy (volume level)
    let totalEnergy = 0;
    for (let i = 0; i < dataArray.length; i++) {
      totalEnergy += dataArray[i];
    }

    const averageEnergy = totalEnergy / dataArray.length;
    // console.log({
    //   totalEnergy: totalEnergy,
    //   averageEnergy: totalEnergy / dataArray.length,
    //   threshold,
    // })

    // If the energy exceeds the threshold, assume the user is speaking
    if (averageEnergy > threshold) {
      if (!isSpeaking) {
        isSpeaking = true;
        highlightSpeaker(true, video);  // Mark the speaker as active
      }
    } else {
      if (isSpeaking) {
        isSpeaking = false;
        highlightSpeaker(false, video);  // Mark the speaker as inactive
      }
    }
  }, 100);  // Check every 100ms (adjust the interval for smoother performance)
}

function highlightSpeaker(isSpeaking, video) {
  const speakerGrid = video;

  if (isSpeaking) {
    speakerGrid.style.border = "2px solid #1e90ff";  // Example: highlight with a green border
  } else {
    speakerGrid.style.border = "";  // Remove highlight
  }
}


async function updateLocalVideoStream() {
  const pc = pcInfo;
  if (!pc) return;
  const videoSender = pc.getSenders().find(sender => sender.track && sender.track.kind === 'video');

  if (videoSender) {
    const oldTrack = videoSender.track;

    try {
      // 1. Stop the existing video track
      oldTrack.stop();

      // 2. Obtain a new video track with the desired constraints
      const newStream = localstream;
      const newVideoTrack = newStream.getVideoTracks()[0];

      // 3. Replace the old track with the new track on the sender
      await videoSender.replaceTrack(newVideoTrack);

      // 4. Renegotiate the connection (create and send a new offer)
      await createOfferWithPreferredCodec(pc);

      // Assuming you have a signaling mechanism to send the offer to the remote peer
      // sendSignalingMessage({ type: 'offer', sdp: pc.localDescription });

    } catch (error) {
      console.error("Error updating local video stream:", error);
      showToast('Error', 'Error updating local video stream!');
      // Optionally, you might want to revert to the old track or handle the error gracefully
      if (videoSender && oldTrack && videoSender.replaceTrack) {
        await videoSender.replaceTrack(oldTrack);
      }
    }
  } else {
    console.log("No video sender found.");
  }
}

function getPreferredVideoCodec() {
  const ua = navigator.userAgent;

  if (/iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS/.test(ua)) {
    return "H264"; // iOS Safari prefers H264
  }

  if (/Android/.test(ua) && /Chrome/.test(ua)) {
    return "VP8"; // Android Chrome works well with VP8
  }

  if (/Firefox/.test(ua)) {
    return "VP8"; // Firefox prefers VP8
  }

  if (/Edge|Edg/.test(ua)) {
    return "VP8"; // Edge Chromium supports both, but VP8 is safe
  }

  return "VP8"; // Default fallback
}

function preferCodec(sdp, codec, kind = "video") {
  const lines = sdp.split("\r\n");
  const mLineIndex = lines.findIndex(line => line.startsWith(`m=${kind}`));
  if (mLineIndex === -1) return sdp;

  const codecRegex = new RegExp(`a=rtpmap:(\\d+)\\s${codec}`, "i");
  const codecPayloads = lines
    .filter(line => codecRegex.test(line))
    .map(line => line.match(codecRegex)[1]);

  if (codecPayloads.length === 0) return sdp;

  const mLineParts = lines[mLineIndex].split(" ");
  const newPayloads = codecPayloads.concat(
    mLineParts.slice(3).filter(pt => !codecPayloads.includes(pt))
  );
  lines[mLineIndex] = [...mLineParts.slice(0, 3), ...newPayloads].join(" ");

  return lines.join("\r\n");
}

export async function createOfferWithPreferredCodec(pc) {
  const offer = await pc.createOffer();
  const preferredCodec = getPreferredVideoCodec();
  const modifiedSdp = preferCodec(offer.sdp, preferredCodec);
  await pc.setLocalDescription({ type: offer.type, sdp: modifiedSdp });

  console.log("Preferred codec:", preferredCodec);
  // console.log("Modified SDP:", modifiedSdp);
  return offer;
}

function checkScreenSharingSupport() {
  // iOS check
  const isIos = /iphone|ipod|ipad/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);


  if (isIos) {
    console.log("Screen sharing is not supported on iOS devices via web apps. Please use a native app or WebView.");
    screenShare.setAttribute('disabled', 'true');
    return false;
  } else if ('mediaDevices' in navigator && 'getDisplayMedia' in navigator.mediaDevices) {
    console.log("Screen sharing is supported on this platform.");
    return true;
  } else {
    console.log("Screen sharing is not supported on this platform.");
    screenShare.setAttribute('disabled', 'true');
    return false;
  }
}

checkScreenSharingSupport();