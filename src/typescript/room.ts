import { createScaledrone } from './signalling.js';
import { createOfferWithPreferredCodec } from './media.js';
import { showToast } from './toast.js';
import { receiveChatMessage } from './chat.js';
import { UserInfo, Member, ConnectionStatus, SignallingRef, PeerConnectionInfo, CandidateQueue, CallType } from '../types/index.js';

const membersList: Member[] = [];
const memberSubscribers = new Set<(members: Member[]) => void>();
const userInfo: UserInfo = JSON.parse(window.localStorage.getItem('userInfo') || '{}');

const peerConnections: PeerConnectionInfo = {};
const candidateQueues: CandidateQueue = {}; // queue ICE candidates until remoteDescription is set
let localStream: MediaStream | null = null;
export let pcInfo: RTCPeerConnection | null = null;
export let drone: any = null;
export let room: any = null;
let signallingRef: SignallingRef | null = null;

// State that changes across setupRoom() calls (call -> hangup -> call again) is kept at
// module scope, and the message/negotiation handlers live at module scope too, rather than
// being re-created as closures inside setupRoom() each time. That way the 'online'/'offline'
// listeners below can be bound exactly once for the page's lifetime instead of accumulating
// a new pair - each firing a full reconnect - on every call started after the first.
let currentOnRemoteTrack: ((stream: MediaStream, id: string, name: string, remoteCallType?: CallType) => void) | null = null;
let currentRoomName = '';
let networkListenersBound = false;
let reconnectInFlight = false;

// Per-peer ICE-restart bookkeeping, so a single connectivity blip can't trigger more than
// one concurrent restart (oniceconnectionstatechange and onconnectionstatechange both react
// to the same failure) and repeated failures back off instead of hammering the signalling
// channel with offers.
const restartInProgress: Record<string, boolean> = {};
const restartTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const restartAttempts: Record<string, number> = {};
const ICE_DISCONNECT_GRACE_MS = 4000; // let transient blips (wifi handoff, brief loss) self-heal before restarting
const ICE_RESTART_MAX_BACKOFF_MS = 6000;
const ICE_RESTART_MAX_ATTEMPTS = 4; // after this many failed restarts, fall back to a full reconnect

export const connectionStatus: ConnectionStatus = {
  onChange: null, // function(status: 'connected'|'reconnecting'|'disconnected')
  set(status: 'connected' | 'reconnecting' | 'disconnected') {
    if (typeof this.onChange === 'function') this.onChange(status);
  }
};

// const iceServers1 = [
//   { urls: "stun:stun.l.google.com:19302" },
//   { urls: "stun:stun.l.google.com:5349" },
//   { urls: "stun:stun1.l.google.com:3478" },
//   { urls: "stun:stun1.l.google.com:5349" },
//   { urls: "stun:stun2.l.google.com:19302" },
//   { urls: "stun:stun2.l.google.com:5349" },
//   { urls: "stun:stun3.l.google.com:3478" },
//   { urls: "stun:stun3.l.google.com:5349" },
//   { urls: "stun:stun4.l.google.com:19302" },
//   { urls: "stun:stun4.l.google.com:5349" },
//   { urls: "stun:stun.services.mozilla.com" },
//   { urls: "stun:stun.l.google.com:19302" },
//   {
//     urls: "turn:relay1.expressturn.com:3478",
//     username: "ef9E9FOCD5ZHMASK6A",
//     credential: "LYlVVI3XWKUSTxpy"
//   }
// ];

const iceServers: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302"] },
  {
    urls: ["turn:122.166.150.147:5060?transport=tcp"],
    "username": "test",
    "credential": "pa55w0rd!"
  }
];
const configuration: RTCConfiguration = { iceServers };

export function setupRoom(localStreamRef: MediaStream | null, onRemoteTrack: (stream: MediaStream, id: string, name: string, remoteCallType?: CallType) => void, callType: CallType = 'video'): void {
  localStream = localStreamRef;
  currentOnRemoteTrack = onRemoteTrack;
  currentRoomName = localStorage.getItem('roomName') || 'observable-e7b2d4';
  signallingRef = createScaledrone(currentRoomName, handleOpen, handleMessage, callType);
  drone = signallingRef.drone;
  room = signallingRef.room;

  ensureNetworkListeners();
}

// Bound once for the page's lifetime (see comment above `networkListenersBound`).
function ensureNetworkListeners(): void {
  if (networkListenersBound) return;
  networkListenersBound = true;

  window.addEventListener('online', () => {
    if (!signallingRef) return; // no active call to reconnect
    showToast('Info', 'Network connected. Attempting to reconnect...');
    connectionStatus.set('reconnecting');
    if (signallingRef.isOpen()) {
      // Signalling channel survived - this was likely just a local network blip
      // (wifi handoff, brief loss), so nudge the peer connections directly.
      attemptReconnect();
    } else {
      // Signalling itself is down - make sure it isn't stuck waiting out a backoff
      // delay. Once it reopens, handleOpen() below drives the full peer resync.
      signallingRef.reconnectNow();
    }
  });

  window.addEventListener('offline', () => {
    if (!signallingRef) return;
    showToast('Error', 'Network disconnected. Trying to recover...');
    connectionStatus.set('disconnected');
  });
}

function handleOpen(error?: any): void {
  if (error) return console.error(error);
  if (!signallingRef) return; // torn down (hangup) while a connection attempt was in flight

  // refresh current signalling instances
  drone = signallingRef.drone;
  room = signallingRef.room;

  // re-bind room events each time we (re)connect
  bindRoomEvents();

  // ensure peer reconnection with all participants on reconnect
  attemptReconnect();

  connectionStatus.set('connected');
  console.log('Connected to Scaledrone');
}

function enqueueOrAddCandidate(id: string, candidate: RTCIceCandidateInit): void {
  if (!candidateQueues[id]) candidateQueues[id] = [];
  const pc = peerConnections[id];
  if (pc && pc.remoteDescription && pc.remoteDescription.type) {
    try {
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn('addIceCandidate failed, queueing:', e);
      candidateQueues[id].push(candidate);
    }
  } else {
    candidateQueues[id].push(candidate);
  }
}

async function drainCandidateQueue(id: string): Promise<void> {
  const pc = peerConnections[id];
  if (!pc || !pc.remoteDescription || !candidateQueues[id] || candidateQueues[id].length === 0) return;
  const queue = candidateQueues[id];
  while (queue.length) {
    const cand = queue.shift()!;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(cand));
    } catch (e) {
      console.warn('Failed to add queued ICE candidate:', e);
    }
  }
}

function handleMessage(message: any): void {
  const { data } = message || {};
  const member = message?.member || {};
  const senderId = message?.member?.id;
  console.log({data})
  if (!data) return;

  if (!drone) return;
  if (!senderId || senderId === drone.clientId) return;

  switch (data.type) {
    case 'offer':
      // console.log('Received an offer from', senderId);
      createPeerConnection(senderId, false);
      peerConnections[senderId].setRemoteDescription(new RTCSessionDescription(data.offer)).then(async () => {
        const answer = await peerConnections[senderId].createAnswer();
        await peerConnections[senderId].setLocalDescription(answer);
        drone.publish({ room: currentRoomName, message: { type: 'answer', answer, to: senderId, userInfo } });
        await drainCandidateQueue(senderId);
      }).catch((e: any) => console.error('Failed to handle offer from', senderId, e));
      break;

    case 'answer':
      // console.log('Received an answer from', senderId);
      if (data.to === drone.clientId && peerConnections[senderId]) {
        peerConnections[senderId].setRemoteDescription(new RTCSessionDescription(data.answer)).then(async () => {
          await drainCandidateQueue(senderId);
        }).catch((e: any) => console.error('Failed to handle answer from', senderId, e));
      }
      break;

    case 'candidate':
      // console.log('Received a candidate from', senderId);
      if (data.to === drone.clientId) {
        enqueueOrAddCandidate(senderId, data.candidate);
      }
      break;

    case 'leave':
      console.log(senderId, 'has left the room');
      removeMember(senderId);
      break;

    case 'join':
      // Avoid duplicate entries
      if (!membersList.find(m => m.id === member.id))
        membersList.push(member);
      console.log(senderId, 'has joined the room');
      createPeerConnection(senderId, true);
      break;

    case 'screenShare':
      {
        const videoEl = document.getElementById(senderId);
        if (videoEl)
          data.isShared === true? videoEl.setAttribute('screenShare', 'true') : videoEl.removeAttribute('screenShare');
      }
      break;

    case 'chat':
      // Handle chat messages
      if (data.messageData) {
        receiveChatMessage(data.messageData);
      }
      break;

    case 'dm':
      // Direct message to a specific recipient
      try {
        if (data.to === drone.clientId && data.messageData) {
          import('./users.js').then(({ receiveDirectMessage }) => {
            if (typeof receiveDirectMessage === 'function') {
              receiveDirectMessage(data.messageData, data.fromUserInfo);
            }
          }).catch(() => {});
        }
      } catch {}
      break;

    case 'invite':
      try {
        if (data.to === drone.clientId && data.roomName) {
          const inviter = membersList.find(m => m.id === senderId)?.clientData?.userInfo.nickname || 'Someone';
          const join = confirm(`${inviter} invited you to join room "${data.roomName}". Join now?`);
          if (join) {
            localStorage.setItem('roomName', data.roomName);
            showToast('Info', `Joining room ${data.roomName}...`);
            // simple approach: reload to reinit with new room
            setTimeout(() => location.reload(), 300);
          }
        }
      } catch {}
      break;

    default:
    console.warn('Unknown data type:', data.type);
    showToast('Warning', 'Unknown data type: ' + data.type);
  }
}

function bindRoomEvents(): void {
  if (!room) return;

  room.on('members', (members: any[]) => {
    console.log('Members connected:', members);

    const incomingIds = new Set(members.map(m => m.id));

    members.forEach(member => {
      if (member.id !== drone.clientId) {
        if (!membersList.find(m => m.id === member.id)) membersList.push(member);
        // create or re-create connection if missing
        if (!peerConnections[member.id]) {
          createPeerConnection(member.id, true);
        }
      }
    });

    // Reconcile: the 'members' event is the authoritative current roster. Anyone we still
    // think is a member but who isn't in it any more left while we were disconnected/
    // reconnecting and we simply missed their 'leave' message - clean them up now instead
    // of leaving a ghost peer connection and video tile behind.
    membersList
      .filter(m => m.id !== drone.clientId && !incomingIds.has(m.id))
      .map(m => m.id)
      .forEach(id => removeMember(id));

    notifyMemberSubscribers();
  });

  room.on('member_join', (member: any) => {
    if (!membersList.find(m => m.id === member.id)) membersList.push(member);
    console.log('Member joined:', member.clientData?.userInfo.nickname);
    // If connection already exists due to reconnect, skip creating
    if (!peerConnections[member.id]) {
      createPeerConnection(member.id, false);
    }
    notifyMemberSubscribers();
  });

  room.on('member_leave', (memberObj: any) => {
    console.log('Member left:', membersList.find(m => m.id === memberObj.id)?.clientData?.userInfo?.nickname);
    removeMember(memberObj.id);
    notifyMemberSubscribers();
  });
}

// Shared cleanup for a member who is gone, whatever told us so ('leave' message,
// 'member_leave' event, or the 'members' reconciliation above).
function removeMember(id: string): void {
  const index = membersList.findIndex(m => m.id === id);
  const nickname = index > -1 ? membersList[index]?.clientData?.userInfo?.nickname : undefined;

  const videoEl = document.getElementById(id);
  if (videoEl) {
    videoEl.parentElement?.remove();
    if (nickname) showToast('Info', nickname + ' has left the room!');
  }
  if (index > -1) membersList.splice(index, 1);

  clearIceRestartState(id);
  if (peerConnections[id]) {
    try { peerConnections[id].close(); } catch {}
    delete peerConnections[id];
  }
  delete candidateQueues[id];
  import('./media.js').then(({ removeRemoteAudioContext }) => removeRemoteAudioContext(id)).catch(() => {});

  if (document.querySelector(".Channel")!.childElementCount === 1)
    document.querySelector(".Channel")?.children[0]?.querySelector("video")!.click();
}

function clearIceRestartState(id: string): void {
  if (restartTimers[id]) { clearTimeout(restartTimers[id]); delete restartTimers[id]; }
  delete restartInProgress[id];
  delete restartAttempts[id];
}

// Recomputes the call-wide connection status from every peer connection's state, rather
// than trusting whichever single peer's event fired last - important once there's more
// than one peer in the mesh (one peer being fine shouldn't flip the banner to "Connected"
// while another is still failed).
function refreshOverallConnectionStatus(): void {
  if (!navigator.onLine) { connectionStatus.set('disconnected'); return; }
  const pcs = Object.values(peerConnections);
  if (pcs.length === 0) {
    connectionStatus.set(signallingRef?.isOpen() ? 'connected' : 'reconnecting');
    return;
  }
  const allHealthy = pcs.every(pc =>
    pc.connectionState === 'connected' ||
    pc.iceConnectionState === 'connected' ||
    pc.iceConnectionState === 'completed'
  );
  connectionStatus.set(allHealthy ? 'connected' : 'reconnecting');
}

// Debounced/deduped entry point for reacting to a peer connection going bad. Both
// oniceconnectionstatechange and onconnectionstatechange call this for the same
// underlying failure - the restartInProgress/restartTimers guards below collapse that
// into a single restart instead of firing two competing offers.
function handleConnectivityIssue(pc: RTCPeerConnection, id: string, immediate: boolean): void {
  if (peerConnections[id] !== pc) return; // stale/already-replaced connection
  if (restartInProgress[id] || restartTimers[id]) return; // already handling this

  if (immediate) {
    void attemptIceRestart(pc, id);
    return;
  }

  // "disconnected" is often transient (brief packet loss, wifi handoff) - give it a
  // moment to self-heal before spending a renegotiation on it.
  restartTimers[id] = setTimeout(() => {
    delete restartTimers[id];
    if (peerConnections[id] !== pc) return;
    const state = pc.iceConnectionState;
    if (state === 'failed' || state === 'disconnected') void attemptIceRestart(pc, id);
  }, ICE_DISCONNECT_GRACE_MS);
}

async function createPeerConnection(id: string, isInitiator: boolean): Promise<void> {
  // if we already have a live connection, do not recreate
  if (peerConnections[id] && peerConnections[id].connectionState && peerConnections[id].connectionState !== 'closed') {
    return;
  }

  const pc = pcInfo = new RTCPeerConnection(configuration);
  // Register synchronously, before any `await` below, so a second concurrent call for the
  // same id (e.g. the 'members' resync racing attemptReconnect) sees it immediately and
  // bails via the guard above instead of creating a duplicate connection.
  peerConnections[id] = pc;
  clearIceRestartState(id);

  // Attach local tracks to new connection
  if (localStream)
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream!));

  // Log when ICE candidates are gathered
  pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate && drone) {
      // console.log("New ICE Candidate:", event.candidate);
      drone.publish({ room: currentRoomName,
        message: { type: 'candidate', candidate: event.candidate, to: id, userInfo }
      });
    }
    else {
      // console.log("All ICE candidates have been gathered.");
    }
  };

  // Log ICE connection state changes
  pc.oniceconnectionstatechange = () => {
    // console.log("ICE connection state changed:", pc.iceConnectionState);

    if (pc.iceConnectionState === "failed") {
      connectionStatus.set('reconnecting');
      handleConnectivityIssue(pc, id, true);
    } else if (pc.iceConnectionState === "disconnected") {
      connectionStatus.set('reconnecting');
      handleConnectivityIssue(pc, id, false);
    } else if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
      clearIceRestartState(id);
      refreshOverallConnectionStatus();
    } else if (pc.iceConnectionState === "closed") {
      clearIceRestartState(id);
      const el = document.getElementById(id);
      if (el) el.remove();
      import('./media.js').then(({ removeRemoteAudioContext }) => removeRemoteAudioContext(id)).catch(() => {});
      showToast('Info', 'User has left the room!');
    }
  };

  // Optional: catch connection state changes
  pc.onconnectionstatechange = () => {
    // console.log("PeerConnection state:", pc.connectionState);
    if (pc.connectionState === 'connected') {
      clearIceRestartState(id);
      refreshOverallConnectionStatus();
    } else if (pc.connectionState === 'failed') {
      connectionStatus.set('reconnecting');
      handleConnectivityIssue(pc, id, true);
    } else if (pc.connectionState === 'disconnected') {
      connectionStatus.set('reconnecting');
      handleConnectivityIssue(pc, id, false);
    }
  };

  // Optional: handle negotiation
  pc.onnegotiationneeded = () => {
    // console.log("Negotiation needed");
  };

  // Log signaling state changes
  pc.onsignalingstatechange = () => {
    // console.log("Signaling state changed:", pc.signalingState);
  };

  // Log when tracks are added
  pc.ontrack = (event: RTCTrackEvent) => {
    console.log("Track received:", event.track.kind);
    console.log({stream : event.streams[0], id, name: membersList.find(member => member.id === id)?.clientData.userInfo.nickname || ''});
    currentOnRemoteTrack?.(event.streams[0], id, membersList.find(member => member.id === id)?.clientData.userInfo.nickname || '', getPeerCallType(id));
    const index = membersList.findIndex(member => member.id === id);
    if (index > -1)
      showToast('Info', membersList[index].clientData?.userInfo?.nickname + ' has joined the room!');
  };

  if (isInitiator) {
    try {
      const offer = await createOfferWithPreferredCodec(pc);
      if (offer && drone) {
        drone.publish({ room: currentRoomName, message: { type: 'offer', offer, to: id, userInfo } });
      }
    } catch (e) {
      console.error('Failed to create/send offer to', id, e);
    }
  }
}

async function attemptIceRestart(pc: RTCPeerConnection, id: string): Promise<void> {
  if (peerConnections[id] !== pc) return; // replaced/closed since this was scheduled
  restartInProgress[id] = true;
  try {
    if (pc.signalingState !== 'stable') {
      // A renegotiation is already underway (e.g. the remote side is restarting too) -
      // don't race it with our own offer; retry shortly instead.
      throw new Error('signalling busy: ' + pc.signalingState);
    }
    showToast('Error', 'Connection issue detected. Attempting to reconnect...');
    const offer = await pc.createOffer({ iceRestart: true });
    await pc.setLocalDescription(offer);
    if (!drone) throw new Error('signalling channel unavailable');
    drone.publish({ room: currentRoomName, message: { type: 'offer', offer, to: id, userInfo } });
    restartAttempts[id] = 0;
    delete restartInProgress[id];
  } catch (e) {
    console.warn('ICE restart attempt failed for', id, e);
    delete restartInProgress[id];
    const attempts = (restartAttempts[id] || 0) + 1;
    restartAttempts[id] = attempts;

    if (attempts >= ICE_RESTART_MAX_ATTEMPTS) {
      console.error('ICE restart failed repeatedly for', id, '- falling back to full reconnection.');
      showToast('Error', 'ICE restart failed repeatedly. Attempting full reconnection.');
      restartAttempts[id] = 0;
      attemptReconnect();
      return;
    }

    const delay = Math.min(1500 * attempts, ICE_RESTART_MAX_BACKOFF_MS);
    restartTimers[id] = setTimeout(() => {
      delete restartTimers[id];
      if (peerConnections[id] !== pc) return;
      const state = pc.iceConnectionState;
      if (state === 'failed' || state === 'disconnected') void attemptIceRestart(pc, id);
    }, delay);
  }
}

function attemptReconnect(): void {
  if (reconnectInFlight) return;
  reconnectInFlight = true;
  try {
    // Close and drop existing peer connections
    Object.keys(peerConnections).forEach(peerId => {
      try {
        clearIceRestartState(peerId);
        if (peerConnections[peerId]) {
          peerConnections[peerId].close();
          delete peerConnections[peerId];
        }
      } catch {}
    });
    // Clear queued candidates
    Object.keys(candidateQueues).forEach(id => delete candidateQueues[id]);
    // For all known members, initiate fresh connections
    membersList.forEach(member => {
      if (drone && member.id !== drone.clientId) {
        createPeerConnection(member.id, true).catch(e => console.error('Failed to reconnect to peer', member.id, e));
      }
    });
  } catch (e) {
    console.error('Reconnect attempt failed:', e);
  } finally {
    reconnectInFlight = false;
  }
}

export function getPeerConnections(): PeerConnectionInfo {
  return peerConnections;
}

export function getPeerName(peerId: string): string {
  try {
    if (!peerId) return '';
    const m = membersList.find(x => x?.id === peerId);
    return m?.clientData?.userInfo.nickname || '';
  } catch { return ''; }
}

export function getPeerCallType(peerId: string): CallType | undefined {
  try {
    if (!peerId) return undefined;
    const m = membersList.find(x => x?.id === peerId);
    return m?.clientData?.callType;
  } catch { return undefined; }
}

// Publish updates to subscribers when member list changes
function notifyMemberSubscribers(): void {
  try {
    memberSubscribers.forEach(cb => {
      try { cb(getMembers()); } catch {}
    });
    // Persist current room members snapshot for Rooms Manager
    try {
      const roomName = localStorage.getItem('roomName') || 'observable-e7b2d4';
      const snapshot = getMembers().map(m => ({ id: m.id, nickname: m.clientData?.userInfo.nickname || '' }));
      localStorage.setItem(`rooms_members_${roomName}`, JSON.stringify(snapshot));
    } catch {}
  } catch {}
}

export function subscribeMembers(callback: (members: Member[]) => void): () => void {
  if (typeof callback === 'function') {
    memberSubscribers.add(callback);
    // immediate push
    try { callback(getMembers()); } catch {}
    return () => memberSubscribers.delete(callback);
  }
  return () => {};
}

export function getMembers(): Member[] {
  return membersList.filter(m => !!m && m.id !== (drone?.clientId)).map(m => ({
    id: m.id,
    clientData: m.clientData || {} as UserInfo
  }));
}

export function manualReconnect(): void {
  // Allows UI to trigger a reconnection attempt
  const localVideo = document.getElementById('localVideo');
  if (!localVideo) {
    showToast('Warning', 'Start the call first to reconnect.');
    return;
  }
  if (signallingRef && !signallingRef.isOpen()) {
    // Signalling itself is down (possibly mid-backoff) - force it to retry now rather
    // than making the user wait it out. handleOpen() will resync peers once it's back.
    signallingRef.reconnectNow();
  } else {
    attemptReconnect();
  }
}

export function destroyConnections(): void {
  try {
    // Close all peer connections
    Object.keys(peerConnections).forEach(peerId => {
      try {
        clearIceRestartState(peerId);
        if (peerConnections[peerId]) {
          peerConnections[peerId].close();
          delete peerConnections[peerId];
        }
      } catch {}
      import('./media.js').then(({ removeRemoteAudioContext }) => removeRemoteAudioContext(peerId)).catch(() => {});
    });
    // Clear candidate queues and members
    Object.keys(candidateQueues).forEach(id => delete candidateQueues[id]);
    try { membersList.splice(0, membersList.length); } catch {}
    // Reset references
    pcInfo = null;
    // Permanently stop the signalling channel's own reconnect loop - without this it
    // keeps reviving drone/room in the background and silently rejoins the room after
    // hangup (drone.close() alone just triggers its 'close' -> reconnect handler).
    try { signallingRef?.disconnect(); } catch {}
    signallingRef = null;
    reconnectInFlight = false;
    drone = null;
    room = null;
  } catch {}
}
