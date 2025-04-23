// room.js
import { createScaledrone } from './signalling.js';

const peerConnections = {};
let localStream;

export function setupRoom(localStreamRef, onRemoteTrack) {
  localStream = localStreamRef;

  const ROOM_NAME = 'observable-e7b2d4';
  const { drone, room } = createScaledrone(ROOM_NAME, handleOpen, handleMessage);

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
        createPeerConnection(senderId, false, onRemoteTrack);
        peerConnections[senderId].setRemoteDescription(new RTCSessionDescription(data.offer));
        peerConnections[senderId]
          .createAnswer()
          .then(answer => {
            peerConnections[senderId].setLocalDescription(answer);
            drone.publish({ room: ROOM_NAME, message: { type: 'answer', answer, to: senderId } });
          });
        break;

      case 'answer':
        if (data.to === drone.clientId && peerConnections[senderId]) {
          peerConnections[senderId].setRemoteDescription(new RTCSessionDescription(data.answer));
        }
        break;

      case 'candidate':
        if (data.to === drone.clientId && peerConnections[senderId]) {
          peerConnections[senderId].addIceCandidate(new RTCIceCandidate(data.candidate));
        }
        break;
    }
  }

  room.on('members', members => {
    members.forEach(member => {
      if (member.id !== drone.clientId) {
        createPeerConnection(member.id, true, onRemoteTrack);
      }
    });
  });

  function createPeerConnection(id, isInitiator, onRemoteTrack) {
    const pc = new RTCPeerConnection();

    pc.onicecandidate = event => {
      if (event.candidate) {
        drone.publish({
          room: ROOM_NAME,
          message: { type: 'candidate', candidate: event.candidate, to: id }
        });
      }
    };

    pc.ontrack = event => {
      onRemoteTrack(event.streams[0], id);
    };

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    if (isInitiator) {
      pc.createOffer()
        .then(offer => {
          pc.setLocalDescription(offer);
          drone.publish({ room: ROOM_NAME, message: { type: 'offer', offer, to: id } });
        });
    }

    peerConnections[id] = pc;
  }
}
