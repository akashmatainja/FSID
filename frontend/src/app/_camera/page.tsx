"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Video, VideoOff, Wifi, WifiOff, AlertCircle, RefreshCw } from "lucide-react";
import {
  SignalingChannel,
  fetchIceServers,
  makeRoomCode,
  DEFAULT_PTZ,
  type PTZState,
  type SignalMessage,
} from "@/lib/webrtc";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type Status = "idle" | "starting" | "live" | "error";

export default function CameraPage() {
  const [room, setRoom] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [viewerConnected, setViewerConnected] = useState(false);
  const [error, setError] = useState("");
  const [ptz, setPtz] = useState<PTZState>(DEFAULT_PTZ);

  // Refs that must survive re-renders / live inside callbacks.
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const outgoingRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const sigRef = useRef<SignalingChannel | null>(null);
  const rafRef = useRef<number | null>(null);
  const ptzRef = useRef<PTZState>(DEFAULT_PTZ);
  const iceQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const viewerPresentRef = useRef(false);
  const offeringRef = useRef(false);

  // Read room from the URL (?room=XXXX) on mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("room");
    if (r) {
      setRoom(r.toUpperCase());
    } else {
      setRoomInput(makeRoomCode());
    }
  }, []);

  // ── Canvas render loop: applies digital PTZ to the outgoing frame ──
  const startRenderLoop = useCallback(() => {
    const draw = () => {
      const v = videoRef.current;
      const cv = canvasRef.current;
      if (v && cv && v.readyState >= 2) {
        const ctx = cv.getContext("2d");
        if (ctx) {
          const { zoom, panX, panY } = ptzRef.current;
          const w = cv.width;
          const h = cv.height;
          const sw = w / zoom;
          const sh = h / zoom;
          const maxOffX = w - sw;
          const maxOffY = h - sh;
          const sx = clamp(maxOffX / 2 + (panX * maxOffX) / 2, 0, maxOffX);
          const sy = clamp(maxOffY / 2 + (panY * maxOffY) / 2, 0, maxOffY);
          ctx.drawImage(v, sx, sy, sw, sh, 0, 0, w, h);
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
  }, []);

  const makeOffer = useCallback(async () => {
    const pc = pcRef.current;
    const sig = sigRef.current;
    if (!pc || !sig || offeringRef.current) return;
    offeringRef.current = true;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sig.send({ type: "offer", sdp: offer });
    } catch (e) {
      console.error("[camera] makeOffer failed", e);
    } finally {
      offeringRef.current = false;
    }
  }, []);

  const setupPeer = useCallback(
    async (iceServers: RTCIceServer[]) => {
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      // Add the canvas (PTZ-processed) video track + original mic audio.
      const outgoing = outgoingRef.current!;
      outgoing.getTracks().forEach((t) => pc.addTrack(t, outgoing));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sigRef.current?.send({ type: "ice", candidate: e.candidate.toJSON() });
        }
      };
      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === "connected") setViewerConnected(true);
        if (st === "disconnected" || st === "failed" || st === "closed") {
          setViewerConnected(false);
        }
      };
      pc.onnegotiationneeded = () => {
        if (viewerPresentRef.current) makeOffer();
      };
    },
    [makeOffer]
  );

  const handleSignal = useCallback(
    async (msg: SignalMessage) => {
      const pc = pcRef.current;
      switch (msg.type) {
        case "peers":
          if (msg.roles.includes("viewer")) {
            viewerPresentRef.current = true;
            makeOffer();
          }
          break;
        case "peer-joined":
          if (msg.role === "viewer") {
            viewerPresentRef.current = true;
            makeOffer();
          }
          break;
        case "peer-left":
          if (msg.role === "viewer") {
            viewerPresentRef.current = false;
            setViewerConnected(false);
          }
          break;
        case "answer":
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
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
        case "ptz":
          ptzRef.current = msg.state;
          setPtz(msg.state);
          break;
      }
    },
    [makeOffer]
  );

  const start = useCallback(
    async (roomCode: string) => {
      setError("");
      setStatus("starting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        streamRef.current = stream;

        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();

        // Size the canvas to the camera resolution, then start drawing.
        const cv = canvasRef.current!;
        cv.width = v.videoWidth || 1280;
        cv.height = v.videoHeight || 720;
        startRenderLoop();

        // Build the outgoing stream from the canvas video + mic audio.
        const canvasStream = cv.captureStream(30);
        const outgoing = new MediaStream();
        canvasStream.getVideoTracks().forEach((t) => outgoing.addTrack(t));
        stream.getAudioTracks().forEach((t) => outgoing.addTrack(t));
        outgoingRef.current = outgoing;

        const iceServers = await fetchIceServers();
        await setupPeer(iceServers);

        const sig = new SignalingChannel(roomCode, "camera");
        sig.onMessage = handleSignal;
        sig.connect();
        sigRef.current = sig;

        setStatus("live");
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Could not access the camera";
        setError(message);
        setStatus("error");
      }
    },
    [handleSignal, setupPeer, startRenderLoop]
  );

  const stop = useCallback(() => {
    sigRef.current?.close();
    sigRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    outgoingRef.current = null;
    viewerPresentRef.current = false;
    setViewerConnected(false);
    setStatus("idle");
  }, []);

  // Auto-start when a room is present in the URL.
  useEffect(() => {
    if (room && status === "idle") {
      start(room);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  // Cleanup on unmount.
  useEffect(() => () => stop(), [stop]);

  const beginWithInput = () => {
    const code = roomInput.trim().toUpperCase();
    if (code.length < 4) {
      setError("Enter a valid room code (at least 4 characters)");
      return;
    }
    setRoom(code);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Remote Camera</h1>
              <p className="text-xs text-slate-400">
                {room ? `Room ${room}` : "Set up this device as a camera"}
              </p>
            </div>
          </div>
          {status === "live" && (
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                viewerConnected
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-amber-500/15 text-amber-400"
              }`}
            >
              {viewerConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {viewerConnected ? "Controller connected" : "Waiting for controller"}
            </div>
          )}
        </div>

        {/* Setup form (no room in URL yet) */}
        {!room && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <p className="text-sm text-slate-300">
              Enter the room code shown on the controller dashboard, then allow camera access.
            </p>
            <div className="flex gap-2">
              <input
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                placeholder="ROOM CODE"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-center text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                onClick={beginWithInput}
                className="px-5 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 font-semibold transition-colors"
              >
                Start
              </button>
            </div>
          </div>
        )}

        {/* Video stage */}
        {room && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="relative aspect-video bg-black">
              {/* hidden source video; canvas is what we actually stream */}
              <video ref={videoRef} className="hidden" playsInline muted />
              <canvas ref={canvasRef} className="w-full h-full object-contain" />

              {status === "starting" && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Requesting camera…
                </div>
              )}
              {status === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                  <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
                  <p className="text-sm text-red-300">{error}</p>
                  <button
                    onClick={() => start(room)}
                    className="mt-4 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* live PTZ readout */}
              {status === "live" && (
                <div className="absolute bottom-3 left-3 flex gap-2 text-xs font-mono">
                  <span className="px-2 py-1 rounded bg-black/60 backdrop-blur">
                    ZOOM {ptz.zoom.toFixed(1)}×
                  </span>
                  <span className="px-2 py-1 rounded bg-black/60 backdrop-blur">
                    PAN {ptz.panX.toFixed(2)} / {ptz.panY.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-4 border-t border-slate-800">
              <p className="text-xs text-slate-400">
                This device streams to the controller. Keep this page open.
              </p>
              {status === "live" ? (
                <button
                  onClick={stop}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/90 hover:bg-red-500 text-sm font-semibold"
                >
                  <VideoOff className="w-4 h-4" /> Stop
                </button>
              ) : (
                <button
                  onClick={() => start(room)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-sm font-semibold"
                >
                  <Video className="w-4 h-4" /> Start streaming
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
