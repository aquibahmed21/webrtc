import { showToast } from "./toast.js";

let mediaRecorder = null;
let recordedChunks = [];
let screenStream = null;
let micStream = null;
let mixedStream = null;

const startRecordingBtn = document.getElementById('startRecording');
const stopRecordingBtn = document.getElementById('stopRecording');
const downloadLink = document.getElementById('downloadRecording');
const screenVideo = document.getElementById('screenVideo');

// Start Recording
startRecordingBtn.addEventListener('click', async () => {
  try {
    startRecordingBtn.disabled = true;

    // 1. Get screen stream
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: 60, max: 60 }, // high frame rate for smooth recording
        width: { ideal: 1920 },  // Full HD width
        height: { ideal: 1080 }  // Full HD height
      },
      audio: true // capture system audio if available
    });

    // 2. Get mic stream
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48000 // better audio quality
      }
    });

    // 3. Combine streams
    mixedStream = new MediaStream([
      ...screenStream.getVideoTracks(),
      ...mergeAudioTracks(screenStream, micStream)
    ]);

    if (screenVideo) screenVideo.srcObject = mixedStream;

    // 4. Setup MediaRecorder
    recordedChunks = [];
    const mimeType = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      showToast('Warning', 'VP9 not supported, falling back to default codec');
    }
    mediaRecorder = new MediaRecorder(mixedStream, {
      mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
      videoBitsPerSecond: 5_000_000, // ~5 Mbps
      audioBitsPerSecond: 320_000
    });

    mediaRecorder.ondataavailable = event => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = saveRecording;

    mediaRecorder.start(250); // gather chunks every 250ms

    stopRecordingBtn.disabled = false;
  } catch (err) {
    console.error('Error during recording setup:', err);
    showToast('Error', 'Error during recording setup!');
    startRecordingBtn.disabled = false;
    cleanupStreams();
  }
});

// Stop Recording
stopRecordingBtn.addEventListener('click', () => {
  try {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  } catch (e) {
    console.error('Failed stopping MediaRecorder:', e);
  } finally {
    stopRecordingBtn.disabled = true;
    startRecordingBtn.disabled = false;
    cleanupStreams();
  }
});

// Merge Audio Tracks
function mergeAudioTracks(screenStreamParam, micStreamParam) {
  const context = new AudioContext();
  const destination = context.createMediaStreamDestination();

  let hasScreenAudio = false;

  if (screenStreamParam.getAudioTracks().length > 0) {
    const screenAudioSource = context.createMediaStreamSource(screenStreamParam);
    screenAudioSource.connect(destination);
    hasScreenAudio = true;
  }

  if (micStreamParam.getAudioTracks().length > 0) {
    const micAudioSource = context.createMediaStreamSource(micStreamParam);
    micAudioSource.connect(destination);
  }

  return hasScreenAudio ? destination.stream.getAudioTracks() : micStreamParam.getAudioTracks();
}

// Save Recording
function saveRecording() {
  try {
    if (!recordedChunks.length) {
      showToast('Warning', 'No recorded data available');
      return;
    }
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    if (downloadLink) {
      downloadLink.href = url;
      downloadLink.style.display = 'block';
    }
  } catch (e) {
    console.error('Failed to save recording:', e);
    showToast('Error', 'Failed to save recording');
  }
}

function cleanupStreams() {
  try {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
    }
    if (micStream) {
      micStream.getTracks().forEach(track => track.stop());
    }
    screenStream = null;
    micStream = null;
    mixedStream = null;
  } catch (e) {
    console.warn('Cleanup error:', e);
  }
}