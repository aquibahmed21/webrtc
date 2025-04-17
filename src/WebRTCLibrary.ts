import Scaledrone from 'https://cdn.scaledrone.com/scaledrone.min.js';

interface Member {
  id: string;
  clientData?: any;
  publish: (message: any) => void;
  on: (event: string, listener: (data: any) => void) => void;
}

interface Props {
  channelId?: string;
  roomName?: string;
  videoStream: MediaStream;
  onRoomCreated?: (roomName: string) => void;
  onRemoteStream?: (stream: MediaStream, memberId: string) => void;
  onMemberJoined?: (memberId: string) => void;
  onMemberLeft?: (memberId: string) => void;
}

class WebRTCLibrary {
  private channelId: string;
  private roomName: string | undefined;
  private videoStream: MediaStream;
  private drone: Scaledrone | null = null;
  private room: any = null; // Scaledrone room object
  private members: Member[] = [];
  private peerConnections: { [memberId: string]: RTCPeerConnection } = {};
  private onRoomCreatedCallback: ((roomName: string) => void) | undefined;
  private onRemoteStreamCallback: ((stream: MediaStream, memberId: string) => void) | undefined;
  private onMemberJoinedCallback: ((memberId: string) => void) | undefined;
  private onMemberLeftCallback: ((memberId: string) => void) | undefined;

  constructor(props: Props) {
    this.channelId = props.channelId || 'EoIG3R1I4JdyS4L';
    this.roomName = props.roomName;
    this.videoStream = props.videoStream;
    this.onRoomCreatedCallback = props.onRoomCreated;
    this.onRemoteStreamCallback = props.onRemoteStream;
    this.onMemberJoinedCallback = props.onMemberJoined;
    this.onMemberLeftCallback = props.onMemberLeft;

    this.initialize();
  }

  private async initialize() {
    this.drone = new Scaledrone(this.channelId);

    this.drone.on('open', error => {
      if (error) {
        return console.error(error);
      }
      console.log('Successfully connected to Scaledrone');
      this.joinOrCreateRoom();
    });
  }

  private joinOrCreateRoom() {
    const name = this.roomName || this.generateRandomRoomName();
    this.roomName = name;
    this.room = this.drone?.subscribe(name, { historyCount: 0 });

    this.room.on('open', error => {
      if (error) {
        return console.error(error);
      }
      console.log(`Successfully joined room: ${this.roomName}`);
      if (!this.roomName) {
        this.roomName = name; // Ensure roomName is set
      }
      if (!this.roomName && this.onRoomCreatedCallback) {
        this.onRoomCreatedCallback(name);
      } else if (this.roomName && !this.roomName) {
        this.onRoomCreatedCallback?.(this.roomName);
      }
    });

    this.room.on('members', (members: Member[]) => {
      console.log('MEMBERS', members);
      this.members = members;
      members.forEach(member => {
        if (member.id !== this.drone?.clientId) {
          this.subscribeToMember(member);
        }
      });
    });

    this.room.on('member_joined', (member: Member) => {
      console.log('MEMBER JOINED', member);
      this.members.push(member);
      this.onMemberJoinedCallback?.(member.id);
      this.subscribeToMember(member);
    });

    this.room.on('member_left', (member: Member) => {
      console.log('MEMBER LEFT', member);
      this.members = this.members.filter(m => m.id !== member.id);
      delete this.peerConnections[member.id];
      this.onMemberLeftCallback?.(member.id);
    });
  }

  private async subscribeToMember(member: Member) {
    if (this.peerConnections[member.id]) {
      return;
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    this.peerConnections[member.id] = peerConnection;

    peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        member.publish({ ice: candidate });
      }
    };

    peerConnection.ontrack = event => {
      if (event.streams && event.streams[0]) {
        console.log('REMOTE TRACK RECEIVED', event.streams[0]);
        this.onRemoteStreamCallback?.(event.streams[0], member.id);
      }
    };

    this.videoStream.getTracks().forEach(track => peerConnection.addTrack(track, this.videoStream));

    member.on('offer', async offer => {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      member.publish({ sd: answer });
    });

    member.on('answer', async answer => {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    member.on('candidate', async candidate => {
      if (candidate) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding ICE candidate', e);
        }
      }
    });

    if (member.id !== this.drone?.clientId) {
      this.createOffer(member);
    }
  }

  private async createOffer(member: Member) {
    const peerConnection = this.peerConnections[member.id];
    if (!peerConnection) return;

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    member.publish({ sd: offer });
  }

  private generateRandomRoomName(): string {
    return `observable-${Math.random().toString(36).substring(2, 15)}`;
  }

  getRoomName(): string | undefined {
    return this.roomName;
  }

  close() {
    this.drone?.close();
    Object.values(this.peerConnections).forEach(pc => pc.close());
    this.peerConnections = {};
  }
}

export default WebRTCLibrary;