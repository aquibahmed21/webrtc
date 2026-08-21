// Global type definitions for the WebRTC project

export interface UserInfo {
  id: number;
  nickname: string;
  gender: 'male' | 'female';
  status?: string;
  age?: number;
}

// 'video'/'audio' are regular two-way calls (audio-only skips the camera).
// 'live-host' broadcasts camera/screen to viewers; 'live-viewer' joins
// read-only (never calls getUserMedia) to watch a live-host's stream.
export type CallType = 'video' | 'audio' | 'live-host' | 'live-viewer';

export interface MessageData {
  id: number;
  type: 'message' | 'reaction';
  sender: string;
  senderId: string;
  html?: string;
  text: string;
  timestamp: string;
  replyTo?: number | null;
  attachments?: Attachment[];
  reactions?: Record<string, Set<string> | string[]>;
}

export interface Attachment {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

export interface ReactionPayload {
  id: number;
  type: 'reaction';
  messageId: number;
  emoji: string;
  userId: string;
  userName: string;
  timestamp: string;
}

export interface Member {
  id: string;
  clientData: {
    userInfo: UserInfo;
    callType?: CallType;
  };
}

export interface Theme {
  name: string;
  colors: Record<string, string>;
}

export interface DeviceInfo {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export interface SelectedDevices {
  videoDeviceId: string | null;
  audioDeviceId: string | null;
}

export interface ConnectionStatus {
  onChange: ((status: 'connected' | 'reconnecting' | 'disconnected') => void) | null;
  set: (status: 'connected' | 'reconnecting' | 'disconnected') => void;
}

export interface SignallingRef {
  drone: any; // ScaleDrone instance
  room: any; // ScaleDrone room
  disconnect: () => void; // permanently stop the internal reconnect loop
  reconnectNow: () => void; // force an immediate reconnect attempt, bypassing backoff
  isOpen: () => boolean; // whether the signalling channel is currently connected
}

export interface PeerConnectionInfo {
  [key: string]: RTCPeerConnection;
}

export interface CandidateQueue {
  [key: string]: RTCIceCandidateInit[];
}

export type AudioRouteKind = 'speaker' | 'earpiece' | 'bluetooth' | 'headphones' | 'default';

export interface AudioOutputOption {
  id: string;
  label: string;
  kind: AudioRouteKind;
}

// Global declarations for external libraries
declare global {
  interface Window {
    ScaleDrone: any;
  }

  // Output Devices API (not yet in lib.dom.d.ts for AudioContext) - optional/feature-detected at call sites
  interface AudioContext {
    readonly sinkId?: string;
    setSinkId?(sinkId: string): Promise<void>;
  }
}

export {};
