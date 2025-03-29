import { RTCPeerConnection } from '@roamhq/wrtc';

declare module '@roamhq/wrtc' {
  export class RTCPeerConnection implements RTCPeerConnection {
    constructor(configuration?: RTCConfiguration);
    // ... rest of RTCPeerConnection interface is inherited from lib.dom.d.ts
    connectionState: string;
    signalingState: string;
    onicecandidate: (event: any) => void;
    onconnectionstatechange: () => void;
    onsignalingstatechange: () => void;
    ondatachannel: (event: any) => void;
    createDataChannel(label: string, options?: any): any;
    createOffer(): Promise<RTCSessionDescriptionWithType>;
    createAnswer(): Promise<RTCSessionDescriptionWithType>;
    setLocalDescription(description: RTCSessionDescription): Promise<void>;
    setRemoteDescription(description: RTCSessionDescription): Promise<void>;
    addIceCandidate(candidate: RTCIceCandidate): Promise<void>;
    close(): void;
  }

  export class RTCSessionDescription implements RTCSessionDescription {
    constructor(init?: RTCSessionDescriptionInit);
    // ... rest of RTCSessionDescription interface is inherited from lib.dom.d.ts
  }

  export class RTCIceCandidate implements RTCIceCandidate {
    constructor(init?: RTCIceCandidateInit);
    // ... rest of RTCIceCandidate interface is inherited from lib.dom.d.ts
  }

  interface RTCSessionDescriptionWithType extends RTCSessionDescription {
    type: string;
    sdp: string;
  }

  interface RTCDataChannel {
    label: string;
    onopen: () => void;
    onclose: () => void;
    onmessage: (event: any) => void;
    onerror: (event: any) => void;
    close(): void;
  }
} 