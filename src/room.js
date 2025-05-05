// room.js
import { createScaledrone } from './signalling.js';
import { createOfferWithPreferredCodec } from './media.js';
import { showToast } from './toast.js';

const membersList = [];
const userInfo = JSON.parse(window.localStorage.getItem('userInfo'));

const peerConnections = {};
let localStream;
export let pcInfo = null;
export let drone = null;
export let room = null;

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
  const { drone: createdDrone, room: createdRoom } = createScaledrone(ROOM_NAME, handleOpen, handleMessage);
  drone = createdDrone;
  room = createdRoom;


  function handleOpen(error) {
    if (error) return console.error(error);

    console.log('Connected to Scaledrone');
  }

  function handleMessage(message) {
    const { data, member } = message;
    const senderId = member.id;

    if (senderId === drone.clientId) return;


    switch (data.type) {
      case 'offer':
        // console.log('Received an offer from', senderId);
        createPeerConnection(senderId, false, onRemoteTrack);
        peerConnections[senderId].setRemoteDescription(new RTCSessionDescription(data.offer));
        peerConnections[senderId]
          .createAnswer()
          .then(answer => {
            peerConnections[senderId].setLocalDescription(answer);
            drone.publish({ room: ROOM_NAME, message: { type: 'answer', answer, to: senderId, userInfo } });
          });
        break;

      case 'answer':
        // console.log('Received an answer from', senderId);
        if (data.to === drone.clientId && peerConnections[senderId]) {
          peerConnections[senderId].setRemoteDescription(new RTCSessionDescription(data.answer));
        }
        break;

      case 'candidate':
        // console.log('Received a candidate from', senderId);
        if (data.to === drone.clientId && peerConnections[senderId]) {
          peerConnections[senderId].addIceCandidate(new RTCIceCandidate(data.candidate));
        }
        break;

      case 'leave':
        console.log(senderId, 'has left the room');
        const index = membersList.findIndex(memberObj => member.id === memberObj.id);
        // Remove video from DOM
        const videoEl = document.getElementById(senderId);
        if (videoEl)
        {
          videoEl.remove();
          if (index > -1)
            showToast('Info', membersList[index].clientData.userInfo.nickname + ' has left the room!');
        }
        membersList.splice(index, 1);


        // Close and delete the peer connection
        if (peerConnections[senderId]) {
          peerConnections[senderId].close();
          delete peerConnections[senderId];
        }
        break;

      case 'join':
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

      default:
      console.warn('Unknown data type:', data.type);
      showToast('Warning', 'Unknown data type: ' + data.type);
    }
  }

  room.on('members', members => {
    console.log('Members connected:', members);

    members.forEach(member => {
      if (member.id !== drone.clientId) {
        membersList.push(member);
        createPeerConnection(member.id, true, onRemoteTrack);
      }
    });
  });

  room.on('member_join', member => {
    membersList.push(member);
    console.log('Member joined:', member.clientData?.userInfo.nickname);
    createPeerConnection(member.id, false, onRemoteTrack);
  });

  room.on('member_leave', memberObj => {
    const index = membersList .findIndex(member => member.id === memberObj.id);
    console.log('Member left:', membersList[index].clientData?.userInfo.nickname);
    const videoEl = document.getElementById(memberObj.id);
    if (videoEl) {
      videoEl.remove();
      if (index > -1)
        showToast('Info', membersList[index].clientData.userInfo.nickname + ' has left the room!');
    }
    membersList.splice(index, 1);
    // if (peerConnections[id]) {
    //   peerConnections[id].close();
    //   delete peerConnections[id];
    // }
  });

  async function createPeerConnection(id, isInitiator, onRemoteTrack) {
    const pc = pcInfo = new RTCPeerConnection(configuration);

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
    pc.oniceconnectionstatechange = () => {
      // console.log("ICE connection state changed:", pc.iceConnectionState);

      if (pc.iceConnectionState === "failed") {
        // console.warn("ICE Connection failed. Likely need TURN.");
        document.getElementById(id)?.remove();
        showToast('Error', 'Connection failed. User is not connected!');
      } else if (pc.iceConnectionState === "disconnected") {
        // console.warn("ICE Connection disconnected. Could be a network issue.");
        document.getElementById(id)?.remove();
        showToast('Error', 'Connection disconnected. Could be a network issue!');
      } else if (pc.iceConnectionState === "closed") {
        // console.warn("ICE Connection closed.");
        document.getElementById(id)?.remove();
        showToast('Info', 'User has left the room!');
      }
    };

    // Optional: catch connection state changes
    pc.onconnectionstatechange = () => {
      // console.log("PeerConnection state:", pc.connectionState);
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
      onRemoteTrack(event.streams[0], id);
      const index = membersList.findIndex(member => member.id === id);
      if (index > -1)
        showToast('Info', membersList[index].clientData.userInfo.nickname + ' has joined the room!');

    };

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    if (isInitiator) {
      const offer = await createOfferWithPreferredCodec(pc);
      drone.publish({ room: ROOM_NAME, message: { type: 'offer', offer, to: id, userInfo } });
    }

    peerConnections[id] = pc;
  }
}
