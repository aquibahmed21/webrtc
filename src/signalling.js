// signalling.js
export function createScaledrone(roomName, onOpen, onMessage) {
  const drone = new window.Scaledrone('EoIG3R1I4JdyS4L1');
  const room = drone.subscribe(roomName);

  drone.on('open', onOpen);
  room.on('message', onMessage);

  return { drone, room };
}
