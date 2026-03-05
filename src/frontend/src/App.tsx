import { Toaster } from "@/components/ui/sonner";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// ── VR Panel Controls ────────────────────────────────────────────────────────

interface ControlsProps {
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  controlsVisible: boolean;
  hasVideo: boolean;
  onPlayPause: () => void;
  onSeek: (t: number) => void;
  onVolumeChange: (v: number) => void;
  onMuteToggle: () => void;
  onFullscreen: () => void;
  onOrientationLock: () => void;
  onFileSelect: (file: File) => void;
  panelIndex: number;
}

function formatTime(s: number): string {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function PanelControls({
  playing,
  currentTime,
  duration,
  volume,
  muted,
  controlsVisible,
  hasVideo,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onFullscreen,
  onOrientationLock,
  onFileSelect,
  panelIndex,
}: ControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    // Reset so re-selecting same file fires change event
    e.target.value = "";
  };

  return (
    <div
      className="absolute bottom-0 left-0 right-0 transition-opacity duration-500"
      style={{
        opacity: controlsVisible ? 1 : 0,
        pointerEvents: controlsVisible ? "auto" : "none",
        background:
          "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)",
        padding: "12px 10px 10px",
      }}
    >
      {/* Seek bar */}
      {hasVideo && (
        <div className="mb-2 px-1">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={(e) => onSeek(Number(e.target.value))}
            data-ocid="player.seek_panel"
            className="vr-range w-full"
            style={{ height: "4px" }}
          />
          <div
            className="flex justify-between mt-1"
            style={{ fontSize: "10px", color: "rgba(255,255,255,0.6)" }}
          >
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      )}

      {/* Buttons row */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {/* Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          id={`file-input-${panelIndex}`}
          onChange={handleFileChange}
        />
        <label
          htmlFor={`file-input-${panelIndex}`}
          data-ocid="player.upload_button"
          className="vr-btn cursor-pointer select-none"
          title="Open video file"
          style={{ fontSize: "13px" }}
        >
          📂
        </label>

        {/* Play/Pause */}
        {hasVideo && (
          <button
            type="button"
            onClick={onPlayPause}
            data-ocid="player.toggle"
            className="vr-btn"
            title={playing ? "Pause" : "Play"}
          >
            {playing ? "⏸" : "▶"}
          </button>
        )}

        {/* Mute */}
        {hasVideo && (
          <button
            type="button"
            onClick={onMuteToggle}
            data-ocid="player.mute_toggle"
            className="vr-btn"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
        )}

        {/* Volume slider */}
        {hasVideo && (
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="vr-range"
            style={{ width: "60px", height: "4px" }}
            title="Volume"
          />
        )}

        {/* Fullscreen */}
        <button
          type="button"
          onClick={onFullscreen}
          data-ocid="player.fullscreen_button"
          className="vr-btn"
          title="Fullscreen"
        >
          ⛶
        </button>

        {/* Orientation lock */}
        <button
          type="button"
          onClick={onOrientationLock}
          className="vr-btn"
          title="Lock landscape"
          style={{ fontSize: "11px" }}
        >
          ⟳
        </button>
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvas1Ref = useRef<HTMLCanvasElement | null>(null);
  const canvas2Ref = useRef<HTMLCanvasElement | null>(null);
  const panel1Ref = useRef<HTMLDivElement | null>(null);
  const panel2Ref = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const gyroRef = useRef({ target: 0, current: 0 });
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const installPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isPortrait, setIsPortrait] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  // gyro rotation state for canvases
  const [gyroAngle, setGyroAngle] = useState(0);

  // ── rAF render loop ────────────────────────────────────────────────────────

  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const c1 = canvas1Ref.current;
    const c2 = canvas2Ref.current;
    if (!video || !c1 || !c2) return;

    const ctx1 = c1.getContext("2d");
    const ctx2 = c2.getContext("2d");
    if (ctx1 && c1.width > 0 && c1.height > 0) {
      ctx1.drawImage(video, 0, 0, c1.width, c1.height);
    }
    if (ctx2 && c2.width > 0 && c2.height > 0) {
      ctx2.drawImage(video, 0, 0, c2.width, c2.height);
    }

    // Smooth gyro
    const g = gyroRef.current;
    g.current += (g.target - g.current) * 0.1;
    if (Math.abs(g.current - g.target) > 0.01) {
      setGyroAngle(g.current);
    }

    rafRef.current = requestAnimationFrame(drawFrame);
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(drawFrame);
  }, [drawFrame]);

  const stopLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // ── ResizeObserver for canvases ────────────────────────────────────────────

  useEffect(() => {
    const panels = [panel1Ref.current, panel2Ref.current];
    const canvases = [canvas1Ref.current, canvas2Ref.current];

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const idx = panels.indexOf(entry.target as HTMLDivElement);
        if (idx === -1) continue;
        const canvas = canvases[idx];
        if (!canvas) continue;
        canvas.width = entry.contentRect.width;
        canvas.height = entry.contentRect.height;
      }
    });

    for (const p of panels) {
      if (p) ro.observe(p);
    }
    return () => ro.disconnect();
  }, []);

  // ── Video event listeners ──────────────────────────────────────────────────

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
      setPlaying(true);
      startLoop();
    };
    const onPause = () => {
      setPlaying(false);
      stopLoop();
    };
    const onEnded = () => {
      setPlaying(false);
      stopLoop();
    };
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => {
      setDuration(video.duration);
      setHasVideo(true);
    };
    const onVolumeChange = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("volumechange", onVolumeChange);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("volumechange", onVolumeChange);
    };
  }, [startLoop, stopLoop]);

  // ── Orientation / portrait guard ──────────────────────────────────────────

  useEffect(() => {
    const check = () => setIsPortrait(window.innerHeight > window.innerWidth);
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  // ── Gyroscope ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: DeviceOrientationEvent) => {
      if (e.gamma === null) return;
      const clamped = Math.max(-10, Math.min(10, e.gamma));
      gyroRef.current.target = clamped;
    };
    window.addEventListener("deviceorientation", handler);
    return () => window.removeEventListener("deviceorientation", handler);
  }, []);

  // ── Controls auto-hide ─────────────────────────────────────────────────────

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(
      () => setControlsVisible(false),
      3000,
    );
  }, []);

  useEffect(() => {
    showControls();
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [showControls]);

  // ── PWA install ────────────────────────────────────────────────────────────

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      installPromptRef.current = e as BeforeInstallPromptEvent;
      setShowInstallBanner(true);
    };
    const onAppInstalled = () => setShowInstallBanner(false);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  // ── Service Worker ─────────────────────────────────────────────────────────

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failure is non-critical
      });
    }
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleFileSelect = useCallback((file: File) => {
    const video = videoRef.current;
    if (!video) return;
    const url = URL.createObjectURL(file);
    // Revoke previous object URL if any
    if (video.src?.startsWith("blob:")) {
      URL.revokeObjectURL(video.src);
    }
    video.src = url;
    video.load();
    video.play().catch(() => {});
  }, []);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  const handleSeek = useCallback((t: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = t;
  }, []);

  const handleVolumeChange = useCallback((v: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = v;
    if (v > 0) video.muted = false;
  }, []);

  const handleMuteToggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, []);

  const handleFullscreen = useCallback(() => {
    document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  const handleOrientationLock = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (screen.orientation as any).lock("landscape");
    } catch {
      toast.error("Orientation lock requires fullscreen on this device");
    }
  }, []);

  const handleInstall = useCallback(async () => {
    const prompt = installPromptRef.current;
    if (!prompt) return;
    await prompt.prompt();
    const result = await prompt.userChoice;
    if (result.outcome === "accepted") {
      setShowInstallBanner(false);
    }
  }, []);

  // ── Shared controls props ──────────────────────────────────────────────────

  const controlsProps: Omit<ControlsProps, "panelIndex"> = {
    playing,
    currentTime,
    duration,
    volume,
    muted,
    controlsVisible,
    hasVideo,
    onPlayPause: handlePlayPause,
    onSeek: handleSeek,
    onVolumeChange: handleVolumeChange,
    onMuteToggle: handleMuteToggle,
    onFullscreen: handleFullscreen,
    onOrientationLock: handleOrientationLock,
    onFileSelect: handleFileSelect,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="vr-root"
      role="application"
      aria-label="VR Video Player"
      onClick={showControls}
      onKeyDown={showControls}
      onMouseMove={showControls}
      onTouchStart={showControls}
      style={{
        width: "100vw",
        height: "100dvh",
        display: "flex",
        overflow: "hidden",
        background: "#000",
        position: "fixed",
        top: 0,
        left: 0,
      }}
    >
      {/* Hidden video element */}
      {/* biome-ignore lint/a11y/useMediaCaption: VR player — captions not applicable for local video files */}
      <video
        ref={videoRef}
        style={{ display: "none" }}
        playsInline
        crossOrigin="anonymous"
        preload="metadata"
      />

      {/* Install banner (spans full width above both panels) */}
      {showInstallBanner && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            background: "rgba(0,0,0,0.9)",
            borderBottom: "1px solid rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            padding: "8px 16px",
            color: "#fff",
            fontSize: "13px",
          }}
        >
          <span>📲 Add VR Player to your home screen</span>
          <button
            type="button"
            data-ocid="player.install_button"
            onClick={handleInstall}
            style={{
              background: "#fff",
              color: "#000",
              border: "none",
              borderRadius: "4px",
              padding: "4px 12px",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Install
          </button>
          <button
            type="button"
            onClick={() => setShowInstallBanner(false)}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              fontSize: "16px",
              lineHeight: 1,
              padding: "0 4px",
            }}
            aria-label="Dismiss install banner"
          >
            ×
          </button>
        </div>
      )}

      {/* Left panel */}
      <div
        ref={panel1Ref}
        data-ocid="player.panel"
        style={{
          width: "50vw",
          height: "100dvh",
          position: "relative",
          overflow: "hidden",
          borderRight: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <canvas
          ref={canvas1Ref}
          data-ocid="player.canvas_target"
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            transform: `rotate(${gyroAngle}deg)`,
            transformOrigin: "center center",
          }}
        />

        {/* Empty state — no video loaded */}
        {!hasVideo && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.25)",
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>◉</div>
            <div
              style={{
                fontSize: "12px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              VR
            </div>
          </div>
        )}

        <PanelControls {...controlsProps} panelIndex={1} />
      </div>

      {/* Right panel */}
      <div
        ref={panel2Ref}
        data-ocid="player.panel"
        style={{
          width: "50vw",
          height: "100dvh",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <canvas
          ref={canvas2Ref}
          data-ocid="player.canvas_target"
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            transform: `rotate(${gyroAngle}deg)`,
            transformOrigin: "center center",
          }}
        />

        {/* Empty state — no video loaded */}
        {!hasVideo && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.25)",
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>◉</div>
            <div
              style={{
                fontSize: "12px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              VR
            </div>
          </div>
        )}

        <PanelControls {...controlsProps} panelIndex={2} />
      </div>

      {/* Portrait guard overlay */}
      {isPortrait && (
        <div
          data-ocid="portrait.panel"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "#000",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            gap: "16px",
          }}
        >
          <div style={{ fontSize: "48px" }}>↻</div>
          <p
            style={{
              fontSize: "16px",
              letterSpacing: "0.05em",
              textAlign: "center",
              maxWidth: "260px",
              color: "rgba(255,255,255,0.8)",
            }}
          >
            Please rotate your device to landscape
          </p>
        </div>
      )}

      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "rgba(30,30,30,0.95)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.1)",
            fontSize: "13px",
          },
        }}
      />
    </div>
  );
}
