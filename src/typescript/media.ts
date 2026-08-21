import { pcInfo, drone } from './room.js';
import { showToast } from './toast.js';
import { SelectedDevices } from '../types/index.js';

const userInfo = JSON.parse(window.localStorage.getItem('userInfo') || '{}');

let localwidth = 0;
let localheight = 0;
let localstream: MediaStream | null = null;
let localframeRate = 0;
let localfacingMode: 'user' | 'environment' = 'user';
let selectedVideoDeviceId: string | null = null;
let selectedAudioDeviceId: string | null = null;

export function getCurrentLocalStream(): MediaStream | null {
  return localstream;
}

export function setSelectedDevices({ videoDeviceId, audioDeviceId }: Partial<SelectedDevices>): void {
  if (typeof videoDeviceId === 'string') selectedVideoDeviceId = videoDeviceId || null;
  if (typeof audioDeviceId === 'string') selectedAudioDeviceId = audioDeviceId || null;
}

export function getSelectedDevices(): SelectedDevices {
  return { videoDeviceId: selectedVideoDeviceId, audioDeviceId: selectedAudioDeviceId };
}

// ===== Audio output routing (speaker / earpiece / bluetooth / headphones) =====
// Remote audio is boosted/analysed through a per-peer AudioContext (see handleIncomingStream)
// but is actually played out through a hidden <audio> element fed by that context's
// MediaStreamAudioDestinationNode. We route it this way (rather than straight to
// audioContext.destination) specifically so output switching can use
// HTMLMediaElement.setSinkId, which has much broader real-world support - notably on
// Android - than AudioContext.setSinkId, which is newer and inconsistently implemented
// on mobile even where the method exists on the prototype.
const AUDIO_OUTPUT_STORAGE_KEY = 'selectedAudioOutputId';
interface RemotePeerAudio {
  context: AudioContext;
  element: HTMLAudioElement;
}
const remotePeerAudio = new Map<string, RemotePeerAudio>();

export function isAudioOutputSwitchingSupported(): boolean {
  return typeof HTMLMediaElement !== 'undefined' && typeof HTMLMediaElement.prototype.setSinkId === 'function';
}

export function getStoredAudioOutputId(): string {
  try { return localStorage.getItem(AUDIO_OUTPUT_STORAGE_KEY) || ''; } catch { return ''; }
}

async function applySinkIdToElement(element: HTMLAudioElement, deviceId: string): Promise<void> {
  if (typeof element.setSinkId !== 'function') return;
  try {
    await element.setSinkId(deviceId);
  } catch (e) {
    console.warn('Failed to set audio output for a peer:', e);
  }
}

// Creates the hidden <audio> element a peer's (gain-boosted) audio is actually played through,
// and applies whichever output device the user previously chose.
function createRemoteAudioElement(context: AudioContext, destinationNode: MediaStreamAudioDestinationNode, id: string): HTMLAudioElement {
  const element = new Audio();
  element.autoplay = true;
  element.setAttribute('playsinline', 'true');
  element.srcObject = destinationNode.stream;
  element.play().catch(() => {}); // autoplay can be blocked until a user gesture; call start already required one

  remotePeerAudio.set(id, { context, element });
  const storedOutputId = getStoredAudioOutputId();
  if (storedOutputId) applySinkIdToElement(element, storedOutputId);

  return element;
}

// Called by the UI layer (audioOutput.ts) whenever the user picks a route.
export async function setAudioOutputDevice(deviceId: string): Promise<void> {
  try { localStorage.setItem(AUDIO_OUTPUT_STORAGE_KEY, deviceId); } catch {}
  await Promise.all(Array.from(remotePeerAudio.values()).map(({ element }) => applySinkIdToElement(element, deviceId)));
}

// Called when a peer's video element is torn down so we don't leak AudioContexts/<audio> elements.
export function removeRemoteAudioContext(id: string): void {
  const entry = remotePeerAudio.get(id);
  if (!entry) return;
  try { entry.element.pause(); entry.element.srcObject = null; entry.element.remove(); } catch {}
  try { entry.context.close(); } catch {}
  remotePeerAudio.delete(id);
}

const quality = document.querySelector('#quality') as HTMLElement;
const framerate = document.querySelector('#framerate') as HTMLElement;
const screenShare = document.querySelector('#shareScreen') as HTMLButtonElement;
const muteVideo = document.querySelector('#muteVideo') as HTMLButtonElement;
const switchCamerabutton = document.querySelector('#switchCamera') as HTMLButtonElement;

if (quality) {
  quality.addEventListener('click', async (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.tagName !== 'INPUT') return;
    if (!localstream) return;
    const selectedOption = quality.querySelector("input:checked") as HTMLInputElement;
    if (!selectedOption) return;
    const [width, height] = selectedOption.value.split('x').map(Number);
    if (!await updateStream(width, height, localframeRate)) return;
  });
}

if (framerate) {
  framerate.addEventListener('click', async (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.tagName !== 'INPUT') return;
    if (!localstream) return;
    const selectedOption = framerate.querySelector("input:checked") as HTMLInputElement;
    if (!selectedOption) return;
    const frameRateValue = Number(selectedOption.value);
    if (!await updateStream(localwidth, localheight, frameRateValue)) return;
  });
}

if (screenShare) {
  screenShare.addEventListener('click', async (event: Event) => {
    const target = event.target as HTMLButtonElement;
    const localVideo = document.querySelector("#localVideo") as HTMLVideoElement;
    target.setAttribute('disabled', 'true');
    if (target.getAttribute('isShared') === 'true') {
      target.textContent = '🖥️ Share Screen';
      target.setAttribute('isShared', 'false');
      muteVideo?.removeAttribute('disabled');
      quality?.removeAttribute('disabled');
      framerate?.removeAttribute('disabled');
      switchCamerabutton?.removeAttribute('disabled');
      target.removeAttribute('disabled');
      localVideo?.removeAttribute('screenShare');
      await updateStream(localwidth, localheight, localframeRate);
      if (drone) {
        const roomName = Object.keys(drone.rooms)[0];
        drone.publish({ room: roomName, message: { type: 'screenShare', from: drone.clientId, isShared: false, userInfo } });
      }
      return;
    }

    if (!localstream) { target.removeAttribute('disabled'); return; }

    try {
      // 1. Capture screen using enhanced function
      const screenStream = await startScreenShare();
      if (!screenStream) return;

      target.textContent = '🖥️ Stop Sharing';
      target.setAttribute('isShared', 'true');
      muteVideo?.setAttribute('disabled', 'true');
      quality?.setAttribute('disabled', 'true');
      framerate?.setAttribute('disabled', 'true');
      switchCamerabutton?.setAttribute('disabled', 'true');
      localVideo?.setAttribute('screenShare', 'true');

      if (localstream) {
        const existingVideo = localstream.getVideoTracks()[0];
        if (existingVideo) existingVideo.stop();
        localstream.getVideoTracks().forEach(t => localstream!.removeTrack(t));
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
      target.removeAttribute('disabled');
    }
  });
}

async function getMediaStream(width: number, height: number, frameRate: number, newFacing: 'user' | 'environment'): Promise<MediaStream | null> {
  if (localstream) {
    localstream.getVideoTracks().forEach(e => {
      localstream!.removeTrack(e);
      e.stop();
    });
  }
  try {
    const videoConstraints = selectedVideoDeviceId ? { deviceId: { exact: selectedVideoDeviceId } } : {
      width: { ideal: width },
      height: { ideal: height },
      frameRate: { ideal: frameRate },
      facingMode: { ideal: newFacing }
    };
    const audioConstraints = selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : true;
    const constraints: MediaStreamConstraints = {
      video: videoConstraints,
      audio: localstream ? false : audioConstraints
    };

    const newStream = await navigator.mediaDevices.getUserMedia(constraints);
    return newStream;
  } catch (error) {
    console.error("Failed to get media stream:", error);
    showToast('Error', 'Failed to get media stream!');
    return null;
  }
}

async function updateStream(width: number, height: number, frameRate: number, isLocal = false, isToggle = false): Promise<boolean> {
  localheight = height;
  localwidth = width;
  localframeRate = frameRate;

  const currentFacing = isToggle ? (localstream?.getVideoTracks()[0]?.getSettings().facingMode || 'user') : 'user';
  localfacingMode = isToggle ? (currentFacing === 'user' ? 'environment' : 'user') : localfacingMode;

  const newStream = await getMediaStream(localwidth, localheight, localframeRate, localfacingMode);
  if (!newStream) return false;

  const newVideoTrack = newStream.getVideoTracks()[0];
  const newAudioTrack = newStream.getAudioTracks()[0];

  // Replace track in the existing stream
  if (localstream) {
    const oldTrack = localstream.getVideoTracks()[0];
    if (oldTrack) {
      oldTrack.stop(); // stop the old track
      localstream.removeTrack(oldTrack);
    }

    localstream.addTrack(newVideoTrack);
    if (newAudioTrack && localstream.getAudioTracks().length === 0) {
      localstream.addTrack(newAudioTrack);
    }
  } else {
    localstream = newStream;
  }
  if (isLocal) {
    const video = document.querySelector("#localVideo") as HTMLVideoElement;
    if (video && localstream.getVideoTracks()[0]) {
      video.setAttribute("mode", localstream.getVideoTracks()[0].getSettings().facingMode || 'user');
      video.srcObject = localstream;
    }
  };
  await updateLocalVideoStream();
  await updateLocalAudioStream();
  return true;
}

export function switchCamera(): void {
  updateStream(localwidth, localheight, localframeRate, true, true);
}

export async function switchToSelectedDevices(videoDeviceId: string, audioDeviceId: string): Promise<boolean> {
  if (videoDeviceId) selectedVideoDeviceId = videoDeviceId;
  if (audioDeviceId) selectedAudioDeviceId = audioDeviceId;
  return await updateStream(localwidth, localheight, localframeRate, true, false);
}

// media.ts
export async function getLocalStream(): Promise<MediaStream | null> {
  const selectedOption = quality?.querySelector("input:checked") as HTMLInputElement;
  const [width, height] = (selectedOption?.value || '640x480').split('x').map(Number);
  const framerateInput = framerate?.querySelector("input:checked") as HTMLInputElement;
  const frameRateValue = Number(framerateInput?.value || 30);
  await updateStream(width, height, frameRateValue);
  return localstream;
}

export function createVideoElement(stream: MediaStream, id: string, isLocal = false, name = ''): void {
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
  `;

  const video = div.querySelector('video') as HTMLVideoElement;
  video.srcObject = stream;
  video.id = id;
  video.autoplay = true;
  video.playsInline = true;

  video.setAttribute("memberId", id);

  const channel = document.getElementsByClassName("Channel")[0] as HTMLElement;
  if (!channel) return;

  if (isLocal) {
    video.muted = true;
    channel.appendChild(div);
    if (localstream?.getVideoTracks()[0])
      video.setAttribute("mode", localstream.getVideoTracks()[0].getSettings().facingMode || 'user');
    video.click();
  }
  else  {
    // if (!document.querySelector("#start")!.checkVisibility())
    video.setAttribute("isRemote", "true");
    channel.prepend(div);
    if (channel.childElementCount === 2) video.click();
    handleIncomingStream(stream, video, id);
  }
}

function handleIncomingStream(stream: MediaStream, video: HTMLVideoElement, id: string): void {
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

  // Connect the audio processing chain. The boosted signal is routed to a
  // MediaStreamAudioDestinationNode rather than audioContext.destination, and actually
  // played out through a hidden <audio> element - see createRemoteAudioElement - so that
  // output-device switching can use the more broadly supported HTMLMediaElement.setSinkId.
  const destinationNode = audioContext.createMediaStreamDestination();
  source.connect(analyserNode);
  source.connect(gainNode).connect(destinationNode);
  createRemoteAudioElement(audioContext, destinationNode, id);

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

function highlightSpeaker(isSpeaking: boolean, video: HTMLVideoElement): void {
  const participant = video.closest('.participant') as HTMLElement;
  if (!participant) return;

  if (isSpeaking) {
    participant.classList.add('speaking');
    // participant.style.transform = 'scale(1.02)';
    // participant.style.boxShadow = '0 0 20px rgba(30, 144, 255, 0.6)';
  } else {
    participant.classList.remove('speaking');
    // participant.style.transform = '';
    // participant.style.boxShadow = '';
  }
}

function createAudioLevelIndicator(video: HTMLVideoElement): HTMLElement | null {
  const participant = video.closest('.participant') as HTMLElement;
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

function updateAudioLevelIndicator(indicator: HTMLElement | null, level: number): void {
  if (!indicator) return;

  const bars = indicator.querySelectorAll('.bar');
  const normalizedLevel = Math.min(level / 50, 1); // Normalize to 0-1
  const activeBars = Math.ceil(normalizedLevel * bars.length);

  bars.forEach((bar, index) => {
    const barElement = bar as HTMLElement;
    if (index < activeBars) {
      barElement.style.height = `${(index * 25)}%`;
      barElement.style.opacity = '1';
    } else {
      barElement.style.height = '5px';
      barElement.style.opacity = '0.3';
    }
  });
}

function notifySpeakingStatus(participantId: string, isSpeaking: boolean): void {
  // This would be implemented to notify other participants
  // For now, we'll just log it
  console.log(`Participant ${participantId} is ${isSpeaking ? 'speaking' : 'not speaking'}`);
}

async function updateLocalVideoStream(): Promise<void> {
  const pc = pcInfo;
  if (!pc) return;
  const videoSender = pc.getSenders().find(sender => sender.track && sender.track.kind === 'video');

  if (videoSender) {
    const oldTrack = videoSender.track;

    try {
      // 1. Stop the existing video track
      oldTrack?.stop();

      // 2. Obtain a new video track with the desired constraints
      const newStream = localstream;
      if (!newStream) return;
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

async function updateLocalAudioStream(): Promise<void> {
  const pc = pcInfo;
  if (!pc) return;
  const audioSender = pc.getSenders().find(sender => sender.track && sender.track.kind === 'audio');
  const localAudio = localstream?.getAudioTracks()[0];
  if (!localAudio) return;
  if (audioSender) {
    try {
      await audioSender.replaceTrack(localAudio);
    } catch (error) {
      console.error('Error updating local audio stream:', error);
    }
  } else {
    try {
      pc.addTrack(localAudio, localstream!);
    } catch {}
  }
}

function getPreferredVideoCodec(): string {
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

function getSupportedCodecs(): string[] {
  const codecs: string[] = [];

  // Check VP8 support
  if (RTCRtpReceiver.getCapabilities && RTCRtpReceiver.getCapabilities('video')) {
    const videoCapabilities = RTCRtpReceiver.getCapabilities('video');
    if (videoCapabilities?.codecs) {
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

function preferCodec(sdp: string, codec: string, kind = "video"): string {
  const lines = sdp.split("\r\n");
  const mLineIndex = lines.findIndex(line => line.startsWith(`m=${kind}`));
  if (mLineIndex === -1) return sdp;

  const codecRegex = new RegExp(`a=rtpmap:(\\d+)\\s${codec}`, "i");
  const codecPayloads = lines
    .filter(line => codecRegex.test(line))
    .map(line => line.match(codecRegex)![1]);

  if (codecPayloads.length === 0) return sdp;

  const mLineParts = lines[mLineIndex].split(" ");
  const newPayloads = codecPayloads.concat(
    mLineParts.slice(3).filter(pt => !codecPayloads.includes(pt))
  );
  lines[mLineIndex] = [...mLineParts.slice(0, 3), ...newPayloads].join(" ");

  return lines.join("\r\n");
}

export async function createOfferWithPreferredCodec(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit | null> {
  try {
    const offer = await pc.createOffer();
    const supportedCodecs = getSupportedCodecs();
    const preferredCodec = getPreferredVideoCodec();

    console.log("Supported codecs:", supportedCodecs);
    console.log("Preferred codec:", preferredCodec);

    // Only modify SDP if the preferred codec is supported
    let finalOffer = offer;
    if (supportedCodecs.includes(preferredCodec)) {
      const modifiedSdp = preferCodec(offer.sdp || '', preferredCodec);
      finalOffer = { type: offer.type, sdp: modifiedSdp };
    } else {
      console.warn(`Preferred codec ${preferredCodec} not supported, using default`);
      // Try fallback codecs in order of preference
      const fallbackCodecs = ['VP8', 'H264', 'VP9'];
      for (const codec of fallbackCodecs) {
        if (supportedCodecs.includes(codec)) {
          const modifiedSdp = preferCodec(offer.sdp || '', codec);
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

function checkScreenSharingSupport(): boolean {
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
async function startScreenShare(): Promise<MediaStream | null> {
  try {
    // Check if screen sharing is supported
    if (!checkScreenSharingSupport()) {
      showToast('Error', 'Screen sharing is not supported on this device.');
      return null;
    }

    const constraints: any = {
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
  } catch (error: any) {
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
