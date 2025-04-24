import { pcInfo } from './room.js';

let localwidth = 0;
let localheight = 0;
let localstream = null;
let localframeRate = 0;

const quality = document.querySelector('#quality');
const framerate = document.querySelector('#framerate');

quality.addEventListener('change', async event => {
  if (!localstream) return;
  const [width, height] = event.target.value.split('x').map(Number);
  if (!await updateStream(width, height, localframeRate)) return;

  await updateLocalVideoStream();
});
framerate.addEventListener('change', async event => {
  if (!localstream) return;

  const framerate = Number(event.target.value);
  if (!await updateStream(localwidth, localheight, framerate)) return;

  await updateLocalVideoStream();
});

async function getMediaStream(width, height, frameRate) {
  try {
    const constraints = {
      video: {
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: frameRate }
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

export async function getCameraList() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      console.log("enumerateDevices() not supported.");
      return [];
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === 'videoinput');
    return cameras;
  } catch (error) {
    console.error("Error getting camera list:", error);
    return [];
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
  // if ( isLocal ) video.muted = true;
  if (isLocal)
    document.getElementsByClassName("Channel")[0].appendChild(video);
  else
    document.getElementsByClassName("Channel")[0].prepend(video);
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
  console.log("Modified SDP:", modifiedSdp);
  return offer;
}

