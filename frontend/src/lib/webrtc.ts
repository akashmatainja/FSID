// Shared helpers for the Remote Camera feature (WebRTC + signaling).
//
// The backend exposes:
//   GET /webrtc/ice        -> { iceServers: RTCIceServer[] }
//   WS  /rtc?room&role      -> room-based JSON signaling relay
//
// Both the public camera page and the authenticated viewer page use these.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export type PTZState = { zoom: number; panX: number; panY: number };

export const DEFAULT_PTZ: PTZState = { zoom: 1, panX: 0, panY: 0 };

export type SignalRole = "camera" | "viewer";

// Messages exchanged over the signaling channel.
export type SignalMessage =
  | { type: "peers"; roles: SignalRole[] }
  | { type: "peer-joined"; role: SignalRole }
  | { type: "peer-left"; role: SignalRole }
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; candidate: RTCIceCandidateInit }
  | { type: "ptz"; state: PTZState };

// Fetch ICE servers (STUN + TURN) from the backend, with a safe STUN-only fallback.
export async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch(`${API_URL}/webrtc/ice`);
    if (!res.ok) throw new Error("ice fetch failed");
    const data = await res.json();
    if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
      return data.iceServers as RTCIceServer[];
    }
  } catch {
    // ignore — fall through to default
  }
  return [{ urls: "stun:stun.l.google.com:19302" }];
}

function wsBase(): string {
  return API_URL.replace(/^https/, "wss").replace(/^http/, "ws");
}

// A tiny wrapper around the signaling WebSocket with JSON helpers,
// auto-reconnect, and typed message callbacks.
export class SignalingChannel {
  private ws: WebSocket | null = null;
  private url: string;
  private closedByUser = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  onMessage: (msg: SignalMessage) => void = () => {};
  onOpen: () => void = () => {};
  onClose: () => void = () => {};

  constructor(room: string, role: SignalRole) {
    this.url = `${wsBase()}/rtc?room=${encodeURIComponent(room)}&role=${role}`;
  }

  connect() {
    this.closedByUser = false;
    try {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.onopen = () => this.onOpen();
      ws.onmessage = (e) => {
        try {
          this.onMessage(JSON.parse(e.data) as SignalMessage);
        } catch {
          /* ignore malformed */
        }
      };
      ws.onclose = () => {
        this.onClose();
        if (!this.closedByUser) {
          this.reconnectTimer = setTimeout(() => this.connect(), 2500);
        }
      };
      ws.onerror = () => ws.close();
    } catch {
      if (!this.closedByUser) {
        this.reconnectTimer = setTimeout(() => this.connect(), 2500);
      }
    }
  }

  send(msg: SignalMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  get isOpen() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  close() {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}

// Generate a short, human-friendly room code.
export function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
