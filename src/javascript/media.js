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


if (quality) {
  quality.addEventListener('click', async event => {
    if (event.target.tagName !== 'INPUT') return;
    if (!localstream) return;
    const selectedOption = quality.querySelector("input:checked")?.value;
    if (!selectedOption) return;
    const [width, height] = selectedOption.split('x').map(Number);
    if (!await updateStream(width, height, localframeRate)) return;
  });
}

if (framerate) {
  framerate.addEventListener('click', async event => {
    if (event.target.tagName !== 'INPUT') return;
    if (!localstream) return;
    const selectedOption = framerate.querySelector("input:checked")?.value;
    if (!selectedOption) return;
    const frameRateValue = Number(selectedOption);
    if (!await updateStream(localwidth, localheight, frameRateValue)) return;
  });
}

if (screenShare) {
  screenShare.addEventListener('click', async event => {
    const localVideo = document.querySelector("#localVideo");
    event.target.setAttribute('disabled', 'true');
    if (event.target.getAttribute('isShared') === 'true') {
      event.target.textContent = '🖥️ Share Screen';
      event.target.setAttribute('isShared', 'false');
      muteVideo?.removeAttribute('disabled');
      quality?.removeAttribute('disabled');
      framerate?.removeAttribute('disabled');
      switchCamerabutton?.removeAttribute('disabled');
      event.target.removeAttribute('disabled');
      localVideo?.removeAttribute('screenShare');
      await updateStream(localwidth, localheight, localframeRate);
      if (drone) {
        const roomName = Object.keys(drone.rooms)[0];
        drone.publish({ room: roomName, message: { type: 'screenShare', from: drone.clientId, isShared: false, userInfo } });
      }
      return;
    }

    if (!localstream) { event.target.removeAttribute('disabled'); return; }

    try {
      // 1. Capture screen using enhanced function
      const screenStream = await startScreenShare();
      if (!screenStream) return;

      event.target.textContent = '🖥️ Stop Sharing';
      event.target.setAttribute('isShared', 'true');
      muteVideo?.setAttribute('disabled', 'true');
      quality?.setAttribute('disabled', 'true');
      framerate?.setAttribute('disabled', 'true');
      switchCamerabutton?.setAttribute('disabled', 'true');
      localVideo?.setAttribute('screenShare', 'true');

      if (localstream) {
        const existingVideo = localstream.getVideoTracks()[0];
        if (existingVideo) existingVideo.stop();
        localstream.getVideoTracks().forEach(t => localstream.removeTrack(t));
      }

      // 2. Replace local video track
      const videoTrack = screenStream.getVideoTracks()[0];
      localstream.addTrack(videoTrack);
      await updateLocalVideoStream();
      if (drone) {
        const roomName = Object.keys(drone.rooms)[0];
        drone.publish({ room: roomName, message: { type: 'screenShare', from: drone.clientId, isShared: true, userInfo } });
      }
    } catch (err) {
      console.error('Error starting screen share:', err);
      showToast('Error', 'Error starting screen share');
    }
    finally {
      event.target.removeAttribute('disabled');
    }
  });
}

async function getMediaStream(width, height, frameRate, newFacing) {

  if (localstream) {
    localstream.getVideoTracks().forEach(e => {
      localstream.removeTrack(e);
      e.stop();
    });
  }
  try {
    const constraints = {
      video: {
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: frameRate },
        facingMode: { ideal: newFacing }
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

  const currentFacing = isToggle ? (localstream?.getVideoTracks()[0]?.getSettings().facingMode || 'user') : 'user';
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
    if (video && localstream.getVideoTracks()[0]) {
      video.setAttribute("mode", localstream.getVideoTracks()[0].getSettings().facingMode || 'user');
      video.srcObject = localstream;
    }
  };
  await updateLocalVideoStream();
  return true;
}

export function switchCamera() {
  updateStream(localwidth, localheight, localframeRate, true, true);
}

// media.js
export async function getLocalStream() {
  const selectedOption = quality?.querySelector("input:checked")?.value || '640x480';
  const [width, height] = selectedOption.split('x').map(Number);
  const framerateInput = framerate?.querySelector("input:checked");
  const frameRateValue = Number(framerateInput?.value || 30);
  await updateStream(width, height, frameRateValue);
  return localstream;
}

export function createVideoElement(stream, id, isLocal = false, name = '') {
  const div = document.createElement('div');
  div.className = "participant";
  div.setAttribute("data-id", id);
  div.innerHTML = `<video autoplay playsinline></video>
    <div class="overlay">
      <span class="name">${name}</span>
      <div class="controls">
        <button class="muteAudio">🔇</button>
        <button class="muteVideo">🎥</button>
        <button class="switchCamera">🔄</button>
        <button class="hangup">📞</button>
      </div>
    </div>
  </div>`;


  const video = div.querySelector('video');
  video.srcObject = stream;
  video.id = id;
  video.autoplay = true;
  video.playsInline = true;

  video.setAttribute("memberId", id);

  const channel = document.getElementsByClassName("Channel")[0];
  if (!channel) return;

  if (isLocal) {
    video.muted = true;
    channel.appendChild(div);
    if (localstream?.getVideoTracks()[0])
      video.setAttribute("mode", localstream.getVideoTracks()[0].getSettings().facingMode || 'user');
    video.click();
  }
  else {
    video.setAttribute("isRemote", "true");
    channel.prepend(div);
    handleIncomingStream(stream, video);
  }
}

function handleIncomingStream(stream, video) {
  const threshold = 20;  // Voice activity detection threshold
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);

  const gainNode = audioContext.createGain();
  gainNode.gain.value = 2.5; // Boost the gain

  // Create AnalyserNode for frequency data analysis
  const analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 256;
  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  // Connect the audio processing chain
  source.connect(analyserNode);
  source.connect(gainNode).connect(audioContext.destination);

  video.srcObject = stream;
  video.volume = 0; // mute video element to avoid double audio
  
  let isSpeaking = false;
  let lastActivityTime = 0;
  const activityTimeout = 500; // 500ms timeout for voice activity

  // Create audio level indicator
  const audioLevelIndicator = createAudioLevelIndicator(video);

  // Monitor audio levels periodically
  const monitorInterval = setInterval(() => {
    analyserNode.getByteFrequencyData(dataArray);

    // Calculate the total energy (volume level)
    let totalEnergy = 0;
    for (let i = 0; i < dataArray.length; i++) {
      totalEnergy += dataArray[i];
    }

    const averageEnergy = totalEnergy / dataArray.length;
    const currentTime = Date.now();

    // Update audio level indicator
    updateAudioLevelIndicator(audioLevelIndicator, averageEnergy);

    // Voice activity detection with timeout
    if (averageEnergy > threshold) {
      lastActivityTime = currentTime;
      if (!isSpeaking) {
        isSpeaking = true;
        highlightSpeaker(true, video);
        // Notify other participants about speaking status
        notifySpeakingStatus(video.id, true);
      }
    } else if (currentTime - lastActivityTime > activityTimeout && isSpeaking) {
      isSpeaking = false;
      highlightSpeaker(false, video);
      // Notify other participants about speaking status
      notifySpeakingStatus(video.id, false);
    }
  }, 100);

  // Clean up when video is removed
  video.addEventListener('removed', () => {
    clearInterval(monitorInterval);
    audioContext.close();
  });
}

function highlightSpeaker(isSpeaking, video) {
  const participant = video.closest('.participant');
  if (!participant) return;

  if (isSpeaking) {
    participant.classList.add('speaking');
    participant.style.transform = 'scale(1.02)';
    participant.style.boxShadow = '0 0 20px rgba(30, 144, 255, 0.6)';
  } else {
    participant.classList.remove('speaking');
    participant.style.transform = '';
    participant.style.boxShadow = '';
  }
}

function createAudioLevelIndicator(video) {
  const participant = video.closest('.participant');
  if (!participant) return null;

  const indicator = document.createElement('div');
  indicator.className = 'audio-level-indicator';
  indicator.innerHTML = `
    <div class="audio-bars">
      <div class="bar"></div>
      <div class="bar"></div>
      <div class="bar"></div>
      <div class="bar"></div>
    </div>
  `;
  
  participant.appendChild(indicator);
  return indicator;
}

function updateAudioLevelIndicator(indicator, level) {
  if (!indicator) return;
  
  const bars = indicator.querySelectorAll('.bar');
  const normalizedLevel = Math.min(level / 50, 1); // Normalize to 0-1
  const activeBars = Math.ceil(normalizedLevel * bars.length);
  
  bars.forEach((bar, index) => {
    if (index < activeBars) {
      bar.style.height = `${20 + (index * 5)}px`;
      bar.style.opacity = '1';
    } else {
      bar.style.height = '5px';
      bar.style.opacity = '0.3';
    }
  });
}

function notifySpeakingStatus(participantId, isSpeaking) {
  // This would be implemented to notify other participants
  // For now, we'll just log it
  console.log(`Participant ${participantId} is ${isSpeaking ? 'speaking' : 'not speaking'}`);
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
    } catch (error) {
      console.error("Error updating local video stream:", error);
      showToast('Error', 'Error updating local video stream!');
      // Optionally, you might want to revert to the old track or handle the error gracefully
      if (videoSender && oldTrack && videoSender.replaceTrack) {
        try { await videoSender.replaceTrack(oldTrack); } catch {}
      }
    }
  } else {
    console.log("No video sender found.");
  }
}

function getPreferredVideoCodec() {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua);
  const isChrome = /Chrome/.test(ua) && !/Edge|Edg/.test(ua);
  const isFirefox = /Firefox/.test(ua);
  const isEdge = /Edge|Edg/.test(ua);

  // iOS Safari - H264 is most reliable
  if (isIOS && isSafari) {
    return "H264";
  }

  // iOS Chrome/Firefox - VP8 works better than H264
  if (isIOS && (isChrome || isFirefox)) {
    return "VP8";
  }

  // Android Chrome - VP8 is preferred for better performance
  if (isAndroid && isChrome) {
    return "VP8";
  }

  // Android Firefox - VP8
  if (isAndroid && isFirefox) {
    return "VP8";
  }

  // Desktop Safari - H264 for better compatibility
  if (isSafari && !isIOS) {
    return "H264";
  }

  // Desktop Chrome - VP8 for better performance
  if (isChrome && !isAndroid) {
    return "VP8";
  }

  // Firefox - VP8
  if (isFirefox && !isIOS) {
    return "VP8";
  }

  // Edge - VP8 is safer
  if (isEdge) {
    return "VP8";
  }

  // Fallback - try VP8 first, then H264
  return "VP8";
}

function getSupportedCodecs() {
  const codecs = [];
  
  // Check VP8 support
  if (RTCRtpReceiver.getCapabilities && RTCRtpReceiver.getCapabilities('video')) {
    const videoCapabilities = RTCRtpReceiver.getCapabilities('video');
    if (videoCapabilities.codecs) {
      videoCapabilities.codecs.forEach(codec => {
        if (codec.mimeType.includes('VP8')) codecs.push('VP8');
        if (codec.mimeType.includes('VP9')) codecs.push('VP9');
        if (codec.mimeType.includes('H264')) codecs.push('H264');
        if (codec.mimeType.includes('AV1')) codecs.push('AV1');
      });
    }
  }
  
  return [...new Set(codecs)]; // Remove duplicates
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
  try {
    const offer = await pc.createOffer();
    const supportedCodecs = getSupportedCodecs();
    const preferredCodec = getPreferredVideoCodec();
    
    console.log("Supported codecs:", supportedCodecs);
    console.log("Preferred codec:", preferredCodec);
    
    // Only modify SDP if the preferred codec is supported
    let finalOffer = offer;
    if (supportedCodecs.includes(preferredCodec)) {
      const modifiedSdp = preferCodec(offer.sdp, preferredCodec);
      finalOffer = { type: offer.type, sdp: modifiedSdp };
    } else {
      console.warn(`Preferred codec ${preferredCodec} not supported, using default`);
      // Try fallback codecs in order of preference
      const fallbackCodecs = ['VP8', 'H264', 'VP9'];
      for (const codec of fallbackCodecs) {
        if (supportedCodecs.includes(codec)) {
          const modifiedSdp = preferCodec(offer.sdp, codec);
          finalOffer = { type: offer.type, sdp: modifiedSdp };
          console.log(`Using fallback codec: ${codec}`);
          break;
        }
      }
    }
    
    await pc.setLocalDescription(finalOffer);
    return finalOffer;
  } catch (e) {
    console.error('Failed to create/set local description:', e);
    showToast('Error', 'Failed to negotiate video. Retrying may help.');
    // Try to at least set the unmodified offer if modified fails
    try {
      const fallbackOffer = await pc.createOffer();
      await pc.setLocalDescription(fallbackOffer);
      return fallbackOffer;
    } catch {
      return null;
    }
  }
}

function checkScreenSharingSupport() {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua);
  const isChrome = /Chrome/.test(ua) && !/Edge|Edg/.test(ua);
  const isFirefox = /Firefox/.test(ua);
  const isEdge = /Edge|Edg/.test(ua);

  // iOS - Screen sharing not supported in web apps
  if (isIOS) {
    console.log("Screen sharing is not supported on iOS devices via web apps.");
    if (screenShare) {
      screenShare.style.display = 'none';
      screenShare.setAttribute('disabled', 'true');
    }
    return false;
  }

  // Android - Limited support, mostly Chrome
  if (isAndroid) {
    if (isChrome) {
      // Check if getDisplayMedia is available
      if ('mediaDevices' in navigator && 'getDisplayMedia' in navigator.mediaDevices) {
        console.log("Screen sharing is supported on Android Chrome.");
        return true;
      }
    }
    console.log("Screen sharing is not supported on this Android browser.");
    if (screenShare) {
      screenShare.style.display = 'none';
      screenShare.setAttribute('disabled', 'true');
    }
    return false;
  }

  // Desktop browsers
  if ('mediaDevices' in navigator && 'getDisplayMedia' in navigator.mediaDevices) {
    // Additional checks for specific browsers
    if (isSafari) {
      // Safari on desktop has limited screen sharing support
      console.log("Screen sharing is supported on desktop Safari (limited).");
      return true;
    } else if (isChrome || isFirefox || isEdge) {
      console.log("Screen sharing is fully supported on this desktop browser.");
      return true;
    }
  }

  // Fallback - not supported
  console.log("Screen sharing is not supported on this platform.");
  if (screenShare) {
    screenShare.style.display = 'none';
    screenShare.setAttribute('disabled', 'true');
  }
  return false;
}

// Enhanced screen sharing with better error handling
async function startScreenShare() {
  try {
    // Check if screen sharing is supported
    if (!checkScreenSharingSupport()) {
      showToast('Error', 'Screen sharing is not supported on this device.');
      return null;
    }

    const constraints = {
      video: {
        mediaSource: 'screen',
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 }
      },
      audio: true
    };

    const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
    
    // Handle when user stops sharing via browser UI
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      console.log('Screen sharing ended by user');
      if (screenShare) {
        screenShare.textContent = '🖥️ Share Screen';
        screenShare.setAttribute('isShared', 'false');
        screenShare.removeAttribute('disabled');
      }
    });

    return stream;
  } catch (error) {
    console.error('Screen sharing error:', error);
    if (error.name === 'NotAllowedError') {
      showToast('Error', 'Screen sharing permission denied.');
    } else if (error.name === 'NotSupportedError') {
      showToast('Error', 'Screen sharing not supported on this device.');
    } else {
      showToast('Error', 'Failed to start screen sharing.');
    }
    return null;
  }
}

checkScreenSharingSupport();