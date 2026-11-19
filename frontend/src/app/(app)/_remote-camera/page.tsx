"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Video, VideoOff, Copy, Check, RefreshCw, Wifi, WifiOff,
  ZoomIn, ZoomOut, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Crosshair, Volume2, VolumeX, Maximize2, Save,
} from "lucide-react";
import {
  SignalingChannel, fetchIceServers, makeRoomCode,
  DEFAULT_PTZ, type PTZState, type SignalMessage,
} from "@/lib/webrtc";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const PAN_STEP = 0.25;
const ZOOM_MIN = 1;
const ZOOM_MAX = 5;

export default function RemoteCameraPage() {
  const [room, setRoom] = useState("");
  const [cameraPresent, setCameraPresent] = useState(false);
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [muted, setMuted] = useState(true);
  const [copied, setCopied] = useState(false);
  const [ptz, setPtz] = useState<PTZState>(DEFAULT_PTZ);
  const [presets, setPresets] = useState<(PTZState | null)[]>([null, null, null]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const sigRef = useRef<SignalingChannel | null>(null);
  const iceQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const iceServersRef = useRef<RTCIceServer[]>([]);

  // Generate a room code once on mount.
  useEffect(() => {
    setRoom(makeRoomCode());
  }, []);

  const cameraLink =
    typeof window !== "undefined" && room
      ? `${window.location.origin.replace("localhost", "192.168.1.34")}/camera?room=${room}`
      : "";

  const sendPtz = useCallback((next: PTZState) => {
    setPtz(next);
    sigRef.current?.send({ type: "ptz", state: next });
  }, []);

  const handleSignal = useCallback(async (msg: SignalMessage) => {
    const pc = pcRef.current;
    switch (msg.type) {
      case "peers":
        if (msg.roles.includes("camera")) setCameraPresent(true);
        break;
      case "peer-joined":
        if (msg.role === "camera") setCameraPresent(true);
        break;
      case "peer-left":
        if (msg.role === "camera") {
          setCameraPresent(false);
          setConnected(false);
        }
        break;
      case "offer":
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sigRef.current?.send({ type: "answer", sdp: answer });
          for (const c of iceQueueRef.current) {
            await pc.addIceCandidate(c).catch(() => {});
          }
          iceQueueRef.current = [];
        }
        break;
      case "ice":
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(msg.candidate).catch(() => {});
        } else {
          iceQueueRef.current.push(msg.candidate);
        }
        break;
    }
  }, []);

  const buildPeer = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    pcRef.current = pc;

    pc.ontrack = (e) => {
      if (videoRef.current && e.streams[0]) {
        videoRef.current.srcObject = e.streams[0];
      }
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sigRef.current?.send({ type: "ice", candidate: e.candidate.toJSON() });
      }
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      setConnected(st === "connected");
      if (st === "failed" || st === "closed" || st === "disconnected") {
        setConnected(false);
      }
    };
  }, []);

  const connect = useCallback(async () => {
    if (!room) return;
    iceServersRef.current = await fetchIceServers();
    buildPeer();

    const sig = new SignalingChannel(room, "viewer");
    sig.onMessage = handleSignal;
    sig.connect();
    sigRef.current = sig;
    setStreaming(true);
    // Push current PTZ so a late-joining camera syncs.
    sig.onOpen = () => sig.send({ type: "ptz", state: ptz });
  }, [room, buildPeer, handleSignal, ptz]);

  const disconnect = useCallback(() => {
    sigRef.current?.close();
    sigRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreaming(false);
    setConnected(false);
    setCameraPresent(false);
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(cameraLink);
      setCopied(true);
      toast.success("Camera link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy link");
    }
  };

  const regenerate = () => {
    disconnect();
    setRoom(makeRoomCode());
    setPtz(DEFAULT_PTZ);
  };

  // ── PTZ controls ──
  const zoomTo = (z: number) => sendPtz({ ...ptz, zoom: clamp(z, ZOOM_MIN, ZOOM_MAX) });
  const panBy = (dx: number, dy: number) =>
    sendPtz({ ...ptz, panX: clamp(ptz.panX + dx, -1, 1), panY: clamp(ptz.panY + dy, -1, 1) });
  const resetPtz = () => sendPtz(DEFAULT_PTZ);

  const savePreset = (i: number) => {
    setPresets((p) => p.map((v, idx) => (idx === i ? { ...ptz } : v)));
    toast.success(`Saved preset ${i + 1}`);
  };
  const applyPreset = (i: number) => {
    const p = presets[i];
    if (p) sendPtz(p);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (v) {
      v.muted = !v.muted;
      setMuted(v.muted);
    }
  };

  const goFullscreen = () => videoRef.current?.requestFullscreen?.();

  const panDisabled = ptz.zoom <= 1;

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Remote Camera</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            Live video from a remote device with full pan, tilt &amp; zoom control
          </p>
        </div>
        <div className="flex items-center gap-2">
          {streaming ? (
            <button
              onClick={disconnect}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 font-semibold hover:bg-red-500/20 transition-colors"
            >
              <VideoOff className="w-4 h-4" /> Disconnect
            </button>
          ) : (
            <button
              onClick={connect}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-500 transition-colors"
            >
              <Video className="w-4 h-4" /> Connect
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video */}
        <div className="lg:col-span-2 glass-card p-0 overflow-hidden rounded-2xl">
          <div className="relative aspect-video bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={muted}
              className="w-full h-full object-contain"
            />

            {!connected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-black/40">
                {streaming ? (
                  <>
                    <RefreshCw className="w-7 h-7 animate-spin mb-2" />
                    <p className="text-sm">
                      {cameraPresent ? "Connecting to camera…" : "Waiting for camera to join…"}
                    </p>
                  </>
                ) : (
                  <>
                    <Video className="w-7 h-7 mb-2" />
                    <p className="text-sm">Press Connect, then open the camera link on the remote device</p>
                  </>
                )}
              </div>
            )}

            {/* status + quick actions */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  connected
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-amber-500/20 text-amber-300"
                }`}
              >
                {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {connected ? "Live" : "Offline"}
              </span>
              {connected && (
                <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-black/60 text-white">
                  {ptz.zoom.toFixed(1)}×
                </span>
              )}
            </div>

            {connected && (
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="w-8 h-8 rounded-lg bg-black/60 hover:bg-black/80 flex items-center justify-center text-white"
                  title={muted ? "Unmute" : "Mute"}
                >
                  {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={goFullscreen}
                  className="w-8 h-8 rounded-lg bg-black/60 hover:bg-black/80 flex items-center justify-center text-white"
                  title="Fullscreen"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-6">
          {/* Pairing card */}
          <div className="glass-card p-5 rounded-2xl">
            <h3 className="text-sm font-bold text-foreground mb-3">Pair a camera</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Open this link on the remote device (phone/laptop), or enter room code{" "}
              <span className="font-mono font-bold text-foreground">{room}</span>.
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={cameraLink}
                className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-xs font-mono truncate"
              />
              <button
                onClick={copyLink}
                className="px-3 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-500 transition-colors"
                title="Copy link"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={regenerate}
              className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Generate new room
            </button>
          </div>

          {/* PTZ pad */}
          <div className="glass-card p-5 rounded-2xl">
            <h3 className="text-sm font-bold text-foreground mb-4">Pan &amp; Tilt</h3>
            <div className="grid grid-cols-3 gap-2 w-44 mx-auto">
              <div />
              <PadButton disabled={panDisabled} onClick={() => panBy(0, -PAN_STEP)}>
                <ChevronUp className="w-5 h-5" />
              </PadButton>
              <div />
              <PadButton disabled={panDisabled} onClick={() => panBy(-PAN_STEP, 0)}>
                <ChevronLeft className="w-5 h-5" />
              </PadButton>
              <PadButton onClick={resetPtz} variant="center">
                <Crosshair className="w-5 h-5" />
              </PadButton>
              <PadButton disabled={panDisabled} onClick={() => panBy(PAN_STEP, 0)}>
                <ChevronRight className="w-5 h-5" />
              </PadButton>
              <div />
              <PadButton disabled={panDisabled} onClick={() => panBy(0, PAN_STEP)}>
                <ChevronDown className="w-5 h-5" />
              </PadButton>
              <div />
            </div>
            {panDisabled && (
              <p className="text-xs text-center text-muted-foreground mt-3">
                Zoom in to enable panning
              </p>
            )}
          </div>

          {/* Zoom */}
          <div className="glass-card p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground">Zoom</h3>
              <span className="text-xs font-mono text-muted-foreground">{ptz.zoom.toFixed(1)}×</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => zoomTo(ptz.zoom - 0.5)}
                className="w-9 h-9 rounded-lg bg-muted hover:bg-accent flex items-center justify-center transition-colors"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <input
                type="range"
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                step={0.1}
                value={ptz.zoom}
                onChange={(e) => zoomTo(parseFloat(e.target.value))}
                className="flex-1 accent-brand-600"
              />
              <button
                onClick={() => zoomTo(ptz.zoom + 0.5)}
                className="w-9 h-9 rounded-lg bg-muted hover:bg-accent flex items-center justify-center transition-colors"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Presets */}
          <div className="glass-card p-5 rounded-2xl">
            <h3 className="text-sm font-bold text-foreground mb-3">Presets</h3>
            <div className="grid grid-cols-3 gap-2">
              {presets.map((p, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <button
                    onClick={() => applyPreset(i)}
                    disabled={!p}
                    className={`h-12 rounded-lg text-xs font-semibold transition-colors ${
                      p
                        ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-500/20"
                        : "bg-muted/50 text-muted-foreground cursor-not-allowed"
                    }`}
                  >
                    P{i + 1}
                  </button>
                  <button
                    onClick={() => savePreset(i)}
                    className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Save className="w-3 h-3" /> Save
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PadButton({
  children,
  onClick,
  disabled,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "center";
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      disabled={disabled}
      className={`h-12 rounded-xl flex items-center justify-center transition-colors ${
        variant === "center"
          ? "bg-brand-600 text-white hover:bg-brand-500"
          : disabled
          ? "bg-muted/40 text-muted-foreground/40 cursor-not-allowed"
          : "bg-muted hover:bg-accent text-foreground"
      }`}
    >
      {children}
    </motion.button>
  );
}
