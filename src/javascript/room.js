// room.js
import { createScaledrone } from './signalling.js';
import { createOfferWithPreferredCodec } from './media.js';
import { showToast } from './toast.js';
import { receiveChatMessage } from './chat.js';

const membersList = [];
const userInfo = JSON.parse(window.localStorage.getItem('userInfo'));

const peerConnections = {};
const candidateQueues = {}; // queue ICE candidates until remoteDescription is set
let localStream;
export let pcInfo = null;
export let drone = null;
export let room = null;
let signallingRef = null;

export const connectionStatus = {
  onChange: null, // function(status: 'connected'|'reconnecting'|'disconnected')
  set(status) {
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

const iceServers = [
  { urls: ["stun:stun.l.google.com:19302"] },
  {
    urls:
      ["turn:122.166.150.147:5060?transport=tcp"],
    "username": "test", "credential": "pa55w0rd!"
  }
];
const configuration = { iceServers };

export function setupRoom(localStreamRef, onRemoteTrack) {
  localStream = localStreamRef;
  const ROOM_NAME = 'observable-e7b2d4';
  signallingRef = createScaledrone(ROOM_NAME, handleOpen, handleMessage);
  drone = signallingRef.drone;
  room = signallingRef.room;

  // Network awareness
  window.addEventListener('online', () => {
    showToast('Info', 'Network connected. Attempting to reconnect...');
    connectionStatus.set('reconnecting');
    attemptReconnect(onRemoteTrack);
  });
  window.addEventListener('offline', () => {
    showToast('Error', 'Network disconnected. Trying to recover...');
    connectionStatus.set('disconnected');
  });


  function handleOpen(error) {
    if (error) return console.error(error);

    // refresh current signalling instances
    drone = signallingRef.drone;
    room = signallingRef.room;

    // re-bind room events each time we (re)connect
    bindRoomEvents(onRemoteTrack);

    // ensure peer reconnection with all participants on reconnect
    attemptReconnect(onRemoteTrack);

    connectionStatus.set('connected');
    console.log('Connected to Scaledrone');
  }

  function enqueueOrAddCandidate(id, candidate) {
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

  async function drainCandidateQueue(id) {
    const pc = peerConnections[id];
    if (!pc || !pc.remoteDescription || !candidateQueues[id] || candidateQueues[id].length === 0) return;
    const queue = candidateQueues[id];
    while (queue.length) {
      const cand = queue.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
        console.warn('Failed to add queued ICE candidate:', e);
      }
    }
  }

  function handleMessage(message) {
    const { data, member } = message;
    const senderId = member.id;

    if (!drone) return;
    if (senderId === drone.clientId) return;


    switch (data.type) {
      case 'offer':
        // console.log('Received an offer from', senderId);
        createPeerConnection(senderId, false, onRemoteTrack);
        peerConnections[senderId].setRemoteDescription(new RTCSessionDescription(data.offer)).then(async () => {
          const answer = await peerConnections[senderId].createAnswer();
          await peerConnections[senderId].setLocalDescription(answer);
          drone.publish({ room: ROOM_NAME, message: { type: 'answer', answer, to: senderId, userInfo } });
          await drainCandidateQueue(senderId);
        });
        break;

      case 'answer':
        // console.log('Received an answer from', senderId);
        if (data.to === drone.clientId && peerConnections[senderId]) {
          peerConnections[senderId].setRemoteDescription(new RTCSessionDescription(data.answer)).then(async () => {
            await drainCandidateQueue(senderId);
          });
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
        const index = membersList.findIndex(memberObj => member.id === memberObj.id);
        // Remove video from DOM
        const videoEl = document.getElementById(senderId);
        if (videoEl)
        {
          videoEl.parentElement.remove();
          if (index > -1)
            showToast('Info', membersList[index].clientData.userInfo.nickname + ' has left the room!');
        }
        membersList.splice(index, 1);


        // Close and delete the peer connection
        if (peerConnections[senderId]) {
          peerConnections[senderId].close();
          delete peerConnections[senderId];
        }
        delete candidateQueues[senderId];
        break;

      case 'join':
        // Avoid duplicate entries
        if (!membersList.find(m => m.id === member.id))
          membersList.push(member);
        console.log(senderId, 'has joined the room');
        createPeerConnection(senderId, true, onRemoteTrack);
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

      default:
      console.warn('Unknown data type:', data.type);
      showToast('Warning', 'Unknown data type: ' + data.type);
    }
  }

  function bindRoomEvents(onRemoteTrackCb) {
    if (!room) return;

    room.on('members', members => {
      console.log('Members connected:', members);

      members.forEach(member => {
        if (member.id !== drone.clientId) {
          if (!membersList.find(m => m.id === member.id)) membersList.push(member);
          // create or re-create connection if missing
          if (!peerConnections[member.id]) {
            createPeerConnection(member.id, true, onRemoteTrackCb);
          }
        }
      });
    });

    room.on('member_join', member => {
      if (!membersList.find(m => m.id === member.id)) membersList.push(member);
      console.log('Member joined:', member.clientData?.userInfo.nickname);
      // If connection already exists due to reconnect, skip creating
      if (!peerConnections[member.id]) {
        createPeerConnection(member.id, false, onRemoteTrackCb);
      }
    });

    room.on('member_leave', memberObj => {
      const index = membersList .findIndex(member => member.id === memberObj.id);
      console.log('Member left:', membersList[index]?.clientData?.userInfo?.nickname);
      const videoEl = document.getElementById(memberObj.id);
      if (videoEl) {
        videoEl.parentElement.remove();
        if (index > -1)
          showToast('Info', membersList[index].clientData.userInfo.nickname + ' has left the room!');
      }
      membersList.splice(index, 1);
      if (peerConnections[memberObj.id]) {
        peerConnections[memberObj.id].close();
        delete peerConnections[memberObj.id];
      }
      delete candidateQueues[memberObj.id];
    });
  }

  async function createPeerConnection(id, isInitiator, onRemoteTrack) {
    // if we already have a live connection, do not recreate
    if (peerConnections[id] && peerConnections[id].connectionState && peerConnections[id].connectionState !== 'closed') {
      return;
    }

    const pc = pcInfo = new RTCPeerConnection(configuration);

    // Attach local tracks to new connection
    if (localStream)
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    // Log when ICE candidates are gathered
    pc.onicecandidate = event => {
      if (event.candidate) {
        // console.log("New ICE Candidate:", event.candidate);
        drone.publish({ room: ROOM_NAME,
          message: { type: 'candidate', candidate: event.candidate, to: id, userInfo }
        });
      }
      else {
        // console.log("All ICE candidates have been gathered.");
      }
    };

    // Log ICE connection state changes
    pc.oniceconnectionstatechange = async () => {
      // console.log("ICE connection state changed:", pc.iceConnectionState);

      if (pc.iceConnectionState === "failed") {
        connectionStatus.set('reconnecting');
        showToast('Error', 'Connection failed. Attempting ICE restart...');
        await attemptIceRestart(pc, id, ROOM_NAME);
      } else if (pc.iceConnectionState === "disconnected") {
        connectionStatus.set('reconnecting');
        showToast('Error', 'Connection disconnected. Retrying...');
        await attemptIceRestart(pc, id, ROOM_NAME);
      } else if (pc.iceConnectionState === "closed") {
        const el = document.getElementById(id);
        if (el) el.remove();
        showToast('Info', 'User has left the room!');
      }
    };

    // Optional: catch connection state changes
    pc.onconnectionstatechange = async () => {
      // console.log("PeerConnection state:", pc.connectionState);
      if (pc.connectionState === 'connected') {
        connectionStatus.set('connected');
      }
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        connectionStatus.set('reconnecting');
        await attemptIceRestart(pc, id, ROOM_NAME);
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
    pc.ontrack = event => {
      // console.log("Track received:", event.track.kind);
      onRemoteTrack(event.streams[0], id, membersList.find(member => member.id === id).clientData?.userInfo?.nickname);
      const index = membersList.findIndex(member => member.id === id);
      if (index > -1)
        showToast('Info', membersList[index].clientData.userInfo.nickname + ' has joined the room!');

    };

    if (isInitiator) {
      const offer = await createOfferWithPreferredCodec(pc);
      if (offer) {
        drone.publish({ room: ROOM_NAME, message: { type: 'offer', offer, to: id, userInfo } });
      }
    }

    peerConnections[id] = pc;
  }

  async function attemptIceRestart(pc, id, roomName) {
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      drone.publish({ room: roomName, message: { type: 'offer', offer, to: id, userInfo } });
    } catch (e) {
      console.error('ICE restart failed:', e);
      showToast('Error', 'ICE restart failed. Will attempt full reconnection.');
      attemptReconnect(onRemoteTrack);
    }
  }

  function attemptReconnect(onRemoteTrackCb) {
    try {
      // Close and drop existing peer connections
      Object.keys(peerConnections).forEach(peerId => {
        try {
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
          createPeerConnection(member.id, true, onRemoteTrackCb);
        }
      });
    } catch (e) {
      console.error('Reconnect attempt failed:', e);
    }
  }
}

export function manualReconnect() {
  // Allows UI to trigger a reconnection attempt
  const localVideo = document.getElementById('localVideo');
  const hasLocalStream = !!localVideo;
  if (hasLocalStream) {
    // Trigger reconnection by simulating network-online path
    if (typeof window !== 'undefined') {
      const evt = new Event('online');
      window.dispatchEvent(evt);
    }
  } else {
    showToast('Warning', 'Start the call first to reconnect.');
  }
}
