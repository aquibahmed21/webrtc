// media.js
export async function getLocalStream()
{
  return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
}

export function createVideoElement(stream, id, isLocal = false)
{
  const video = document.createElement('video');
  video.srcObject = stream;
  video.id = id;
  video.autoplay = true;
  video.playsInline = true;
  if (isLocal) video.muted = true;
  document.getElementsByClassName("Channel")[0].appendChild(video);
}
