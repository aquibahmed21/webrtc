import { SignallingRef, UserInfo } from '../types/index.js';

// signalling.ts
export function createScaledrone(roomName: string, onOpen: (error?: any) => void, onMessage: (message: any) => void): SignallingRef {
  const userInfo: UserInfo = JSON.parse(window.localStorage.getItem('userInfo') || '{}');
  const CHANNEL_ID = "EoIG3R1I4JdyS4L1";

  const ref: SignallingRef = { drone: null, room: null };
  let drone: any = null;
  let room: any = null;
  let reconnectAttempts = 0;
  const maxReconnectDelayMs = 15000; // cap backoff

  function connect(): void {
    drone = new window.ScaleDrone(CHANNEL_ID, {
      data: { userInfo },
     });
    room = drone.subscribe(roomName);

    // update outward reference so consumers always see latest instances
    ref.drone = drone;
    ref.room = room;

    drone.on('open', (err: any) => {
      reconnectAttempts = 0;
      onOpen && onOpen(err);
    });

    room.on('message', (msg: any) => onMessage && onMessage(msg));

    drone.on('error', (err: any) => {
      console.error('Scaledrone error:', err);
    });

    // Handle close/disconnect and try to reconnect
    drone.on('close', () => {
      scheduleReconnect();
    });

    // Defensive: room level events
    room.on('error', (err: any) => {
      console.error('Room error:', err);
    });
  }

  function scheduleReconnect(): void {
    if (!navigator.onLine) {
      // wait for online
      window.addEventListener('online', handleOnlineOnce, { once: true });
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts++), maxReconnectDelayMs);
    setTimeout(() => {
      try {
        connect();
      } catch (e) {
        console.error('Reconnect attempt failed:', e);
        scheduleReconnect();
      }
    }, delay);
  }

  function handleOnlineOnce(): void {
    scheduleReconnect();
  }

  // set up initial connection
  connect();

  return ref;
}
