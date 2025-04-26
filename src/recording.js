let mediaRecorder;
let recordedChunks = [];
let screenStream;
let micStream;
let mixedStream;

const startRecordingBtn = document.getElementById('startRecording');
const stopRecordingBtn = document.getElementById('stopRecording');
const downloadLink = document.getElementById('downloadRecording');
const screenVideo = document.getElementById('screenVideo');

// Start Recording
startRecordingBtn.addEventListener('click', async () => {
  try {
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

    screenVideo.srcObject = mixedStream;

    // 4. Setup MediaRecorder
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(mixedStream, {
      mimeType: 'video/webm;codecs=vp9,opus', // VP9 gives better quality at smaller size
      videoBitsPerSecond: 5_000_000, // High bitrate (~5 Mbps) = crisp video
      audioBitsPerSecond: 320_000    // High quality audio bitrate
    });

    mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = saveRecording;

    mediaRecorder.start(100); // gather every 100ms chunk

    startRecordingBtn.disabled = true;
    stopRecordingBtn.disabled = false;

  } catch (err) {
    console.error('Error during recording setup:', err);
    alert('Error: ' + err.message);
  }
});

// Stop Recording
stopRecordingBtn.addEventListener('click', () => {
  mediaRecorder.stop();
  stopRecordingBtn.disabled = true;
  startRecordingBtn.disabled = false;

  // Stop all tracks (screen and mic)
  screenStream.getTracks().forEach(track => track.stop());
  micStream.getTracks().forEach(track => track.stop());
});

// Merge Audio Tracks
function mergeAudioTracks(screenStream, micStream) {
  const context = new AudioContext();
  const destination = context.createMediaStreamDestination();

  let hasScreenAudio = false;

  if (screenStream.getAudioTracks().length > 0) {
    const screenAudioSource = context.createMediaStreamSource(screenStream);
    screenAudioSource.connect(destination);
    hasScreenAudio = true;
  }

  if (micStream.getAudioTracks().length > 0) {
    const micAudioSource = context.createMediaStreamSource(micStream);
    micAudioSource.connect(destination);
  }

  return hasScreenAudio ? destination.stream.getAudioTracks() : micStream.getAudioTracks();
}

// Save Recording
function saveRecording() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  downloadLink.href = url;
  downloadLink.style.display = 'block';
}