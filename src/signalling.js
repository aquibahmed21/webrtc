// signalling.js
export function createScaledrone(roomName, onOpen, onMessage) {
  const userInfo = JSON.parse(window.localStorage.getItem('userInfo'));
  const CHANNEL_ID = "EoIG3R1I4JdyS4L1";
  const drone = new ScaleDrone(CHANNEL_ID, {
    data: { userInfo},
   });
  const room = drone.subscribe(roomName);

  drone.on('open', onOpen);
  room.on('message', onMessage);

  return { drone, room };
}
