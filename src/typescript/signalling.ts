import { SignallingRef, UserInfo, CallType } from '../types/index.js';

// signalling.ts
export function createScaledrone(roomName: string, onOpen: (error?: any) => void, onMessage: (message: any) => void, callType: CallType = 'video'): SignallingRef {
  const userInfo: UserInfo = JSON.parse(window.localStorage.getItem('userInfo') || '{}');
  const CHANNEL_ID = "EoIG3R1I4JdyS4L1";

  const ref: SignallingRef = {
    drone: null,
    room: null,
    disconnect: () => {},
    reconnectNow: () => {},
    isOpen: () => false,
  };
  let drone: any = null;
  let room: any = null;
  let reconnectAttempts = 0;
  const maxReconnectDelayMs = 15000; // cap backoff
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false; // true once the caller explicitly tore this connection down
  let open = false;
  // Bumped on every connect() so a previous generation's drone/room event handlers
  // (which may fire late, or never fire a clean 'close' at all - real network drops
  // routinely leave a WebSocket silently dead with no close frame for minutes) can tell
  // they've been superseded and no-op instead of racing the current connection attempt.
  let generation = 0;

  // Scaledrone enforces a 20 messages/sec publish cap and silently rejects (with an
  // 'error' event, not a thrown exception) anything over it. A burst that size is easy to
  // hit during a reconnect - rebuilding a mesh of peer connections means every one of them
  // gathers and publishes its own batch of ICE candidates at roughly the same moment. When
  // publishes get dropped this way, offers/answers/candidates silently vanish and
  // negotiation never completes - so every publish is routed through a small limiter that
  // queues the overflow instead of firing it straight into the cap.
  const MAX_PUBLISHES_PER_SEC = 15; // headroom under Scaledrone's 20/sec cap
  let publishQueue: any[] = [];
  let publishTokens = MAX_PUBLISHES_PER_SEC;
  let publishFlushTimer: ReturnType<typeof setInterval> | null = null;

  function resetPublishLimiter(): void {
    publishQueue = [];
    publishTokens = MAX_PUBLISHES_PER_SEC;
    if (publishFlushTimer) { clearInterval(publishFlushTimer); publishFlushTimer = null; }
  }

  function attachPublishThrottle(droneInstance: any): void {
    const originalPublish = droneInstance.publish.bind(droneInstance);
    droneInstance.publish = (args: any) => {
      if (publishTokens > 0) {
        publishTokens--;
        try { originalPublish(args); } catch (e) { console.warn('Scaledrone publish failed:', e); }
        return;
      }
      publishQueue.push(args);
      if (!publishFlushTimer) {
        publishFlushTimer = setInterval(() => {
          publishTokens = MAX_PUBLISHES_PER_SEC;
          while (publishTokens > 0 && publishQueue.length) {
            const next = publishQueue.shift();
            publishTokens--;
            try { originalPublish(next); } catch (e) { console.warn('Scaledrone publish failed:', e); }
          }
          if (publishQueue.length === 0 && publishFlushTimer) {
            clearInterval(publishFlushTimer);
            publishFlushTimer = null;
          }
        }, 1000);
      }
    };
  }

  function connect(): void {
    if (stopped) return;
    const myGen = ++generation;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    resetPublishLimiter(); // any queued messages belonged to the connection we're replacing
    open = false;
    try {
      // callType rides along in clientData so every peer's Member entry (room.ts)
      // knows whether this connection is a regular call or a live broadcast/viewer.
      drone = new window.ScaleDrone(CHANNEL_ID, {
        data: { userInfo, callType },
      });
      room = drone.subscribe(roomName);
      attachPublishThrottle(drone);
    } catch (e) {
      console.error('Failed to initialize Scaledrone:', e);
      scheduleReconnect();
      return;
    }

    // update outward reference so consumers always see latest instances
    ref.drone = drone;
    ref.room = room;

    drone.on('open', (err: any) => {
      if (stopped || myGen !== generation) return;
      reconnectAttempts = 0;
      open = !err;
      onOpen && onOpen(err);
    });

    room.on('message', (msg: any) => { if (!stopped && myGen === generation) onMessage && onMessage(msg); });

    drone.on('error', (err: any) => {
      if (myGen !== generation) return;
      console.error('Scaledrone error:', err);
    });

    // Handle close/disconnect and try to reconnect
    drone.on('close', () => {
      if (myGen !== generation) return; // superseded by a newer connection attempt
      open = false;
      scheduleReconnect();
    });

    // Defensive: room level events
    room.on('error', (err: any) => {
      if (myGen !== generation) return;
      console.error('Room error:', err);
    });
  }

  function scheduleReconnect(): void {
    if (stopped) return;
    if (reconnectTimer) return; // already have one pending
    if (!navigator.onLine) {
      // wait for online
      window.addEventListener('online', handleOnlineOnce, { once: true });
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts++), maxReconnectDelayMs);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (stopped) return;
      try {
        connect();
      } catch (e) {
        console.error('Reconnect attempt failed:', e);
        scheduleReconnect();
      }
    }, delay);
  }

  function handleOnlineOnce(): void {
    if (stopped) return;
    scheduleReconnect();
  }

  // set up initial connection
  connect();

  ref.isOpen = () => open;

  // Stop reconnecting permanently (e.g. the user hung up). Without this, closing
  // `drone` still fires its 'close' handler and the backoff loop above would keep
  // reviving the connection - and re-joining the room - in the background.
  ref.disconnect = () => {
    stopped = true;
    generation++; // invalidate this drone's handlers before tearing it down
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    resetPublishLimiter();
    window.removeEventListener('online', handleOnlineOnce);
    try { if (drone && typeof drone.close === 'function') drone.close(); } catch {}
  };

  // Force an immediate reconnect attempt, bypassing any pending backoff delay - used by
  // the UI's manual "Retry" action and by room.ts whenever the browser reports the network
  // coming back. Deliberately unconditional (does NOT gate on `open`): after a real network
  // drop the old socket routinely never fires a clean 'close' event, so `open` can be stuck
  // stale as `true` from before the outage - gating on it here would silently no-op exactly
  // when a forced reconnect is needed most. The generation counter (see connect()) makes
  // this safe even if the old drone does eventually fire a late 'close'/'error'.
  ref.reconnectNow = () => {
    if (stopped) return;
    reconnectAttempts = 0;
    generation++; // invalidate the outgoing drone's handlers before tearing it down, so a
                   // 'close'/'error' it fires (sync or async) can't schedule a competing
                   // reconnect behind connect()'s back
    if (drone && typeof drone.close === 'function') { try { drone.close(); } catch {} }
    connect();
  };

  return ref;
}
