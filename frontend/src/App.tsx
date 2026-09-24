import { useCallback, useEffect, useRef, useState } from "react";
import "@fontsource-variable/sora";
import Alert, { type AlertColor } from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Snackbar from "@mui/material/Snackbar";
import { ThemeProvider } from "@mui/material/styles";
import {
  CameraOff,
  Gauge,
  Layers,
  Maximize,
  Minimize,
  RefreshCw,
  ScanLine,
  ScanSearch,
} from "lucide-react";

import { Brand } from "./components/hud/Brand";
import { DetectionSummary } from "./components/hud/DetectionSummary";
import { MobileDock } from "./components/hud/MobileDock";
import { ModeSelector } from "./components/hud/ModeSelector";
import { StatusPill } from "./components/hud/StatusPill";
import { SystemStatus } from "./components/hud/SystemStatus";
import { Viewfinder } from "./components/hud/Viewfinder";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Separator } from "./components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./components/ui/tooltip";
import { FONT_STACK, muiTheme } from "./theme";
import {
  isModeChangedMessage,
  MODE_DESCRIPTIONS,
  MODE_SUMMARY,
  type Counts,
  type DetectionMode,
  type PerfStats,
  type ServerMessage,
} from "./types";
import ChatWidget from "./components/chatbot/chat";

// =========================================================
// CONSTANTS
// =========================================================

const WS_URL =
  import.meta.env.VITE_WS_URL ?? "ws://192.168.18.7:8000/ws/stream";

const DEFAULT_MODE: DetectionMode = "both";

console.log("APP STARTED");
console.log("WS URL:", WS_URL);

interface ToastState {
  open: boolean;
  severity: AlertColor;
  message: string;
}

// =========================================================
// APP (root: provider tema MUI + tooltip shadcn)
// =========================================================

export default function App() {
  // Cegah auto-translate browser (Google Translate) mengubah struktur DOM.
  // React tidak tahan kalau node teks/elemennya dipindah oleh pihak luar,
  // dan itu bisa membuat seluruh aplikasi crash (layar hitam).
  // Efek ini juga menutup portal MUI (Drawer, Snackbar) di luar <main>.
  useEffect(() => {
    document.documentElement.setAttribute("translate", "no");

    let meta = document.querySelector<HTMLMetaElement>(
      'meta[name="google"][content="notranslate"]',
    );

    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "google";
      meta.content = "notranslate";
      document.head.appendChild(meta);
    }
  }, []);

  return (
    <ThemeProvider theme={muiTheme}>
      <TooltipProvider delayDuration={200}>
        <VisionApp />
      </TooltipProvider>
    </ThemeProvider>
  );
}

// =========================================================
// VISION APP
// =========================================================

function VisionApp() {
  // =========================================================
  // REFS
  // =========================================================

  const wsRef = useRef<WebSocket | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const streamRef = useRef<MediaStream | null>(null);

  /**
   * Mencegah lebih dari satu frame dikirim sekaligus.
   */
  const processingRef = useRef(false);

  /**
   * Status kamera menggunakan ref agar perubahan state
   * tidak menyebabkan useEffect / WebSocket dibuat ulang.
   */
  const cameraReadyRef = useRef(false);

  /**
   * Menandakan component sudah di-unmount.
   */
  const destroyedRef = useRef(false);

  /**
   * Timer reconnect.
   */
  const reconnectTimerRef = useRef<number | null>(null);

  /**
   * Mode aktif disimpan di ref juga, supaya:
   * - onopen bisa mengirim ulang mode terakhir setelah reconnect
   * - connectWebSocket tidak perlu bergantung pada state `mode`
   *   (kalau bergantung, WebSocket akan dibuat ulang setiap ganti mode)
   */
  const modeRef = useRef<DetectionMode>(DEFAULT_MODE);

  /**
   * Waktu frame terakhir dikirim, untuk menghitung latency.
   */
  const sentAtRef = useRef(0);

  /**
   * Jendela 1 detik untuk menghitung FPS dan rata-rata latency.
   */
  const perfWindowRef = useRef({ start: 0, count: 0, latencySum: 0 });

  // =========================================================
  // STATE
  // =========================================================

  const [annotatedImage, setAnnotatedImage] = useState<string | null>(null);

  const [counts, setCounts] = useState<Counts>({
    model1: 0,
    model2: 0,
  });

  const [mode, setMode] = useState<DetectionMode>(DEFAULT_MODE);

  const [perf, setPerf] = useState<PerfStats | null>(null);

  const [isConnected, setIsConnected] = useState(false);

  const [isCameraReady, setIsCameraReady] = useState(false);

  const [cameraError, setCameraError] = useState<string | null>(null);

  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const [debugMessage, setDebugMessage] = useState("APP STARTING");

  const [detailsOpen, setDetailsOpen] = useState(false);

  const [toast, setToast] = useState<ToastState>({
    open: false,
    severity: "info",
    message: "",
  });

  // =========================================================
  // TOAST
  // =========================================================

  const showToast = useCallback((severity: AlertColor, message: string) => {
    setToast({ open: true, severity, message });
  }, []);

  const closeToast = useCallback((_event?: unknown, reason?: string) => {
    if (reason === "clickaway") {
      return;
    }

    setToast((current) => ({ ...current, open: false }));
  }, []);

  // =========================================================
  // CHANGE MODE
  // =========================================================

  const changeMode = useCallback(
    (nextMode: DetectionMode) => {
      if (modeRef.current === nextMode) {
        return;
      }

      modeRef.current = nextMode;

      // Update UI langsung (optimistic)
      setMode(nextMode);

      showToast("info", `Mode: ${MODE_SUMMARY[nextMode]}`);

      const socket = wsRef.current;

      // Kalau socket belum terbuka, mode akan dikirim saat onopen.
      if (socket && socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({ mode: nextMode }));

          console.log("Mode dikirim:", nextMode);
        } catch (error) {
          console.error("Gagal mengirim mode:", error);
        }
      }
    },
    [showToast],
  );

  // =========================================================
  // STOP CAMERA
  // =========================================================

  const stopCamera = useCallback(() => {
    console.log("Stopping camera...");

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      streamRef.current = null;
    }

    cameraReadyRef.current = false;

    setIsCameraReady(false);
  }, []);

  // =========================================================
  // INIT CAMERA
  // =========================================================

  const initCamera = useCallback(async () => {
    try {
      console.log("Requesting camera...");

      setCameraError(null);

      cameraReadyRef.current = false;
      setIsCameraReady(false);

      if (!window.isSecureContext) {
        throw new Error("INSECURE_CONTEXT");
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia tidak tersedia pada device ini.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: "environment",
          },

          width: {
            ideal: 1920,
          },

          height: {
            ideal: 1080,
          },

          frameRate: {
            ideal: 30,
          },
        },

        audio: false,
      });

      streamRef.current = stream;

      const video = videoRef.current;

      if (!video) {
        throw new Error("Video element tidak ditemukan.");
      }

      video.srcObject = stream;

      /**
       * Tunggu metadata kamera siap.
       */
      if (video.readyState < 1) {
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            resolve();
          };
        });
      }

      await video.play();

      cameraReadyRef.current = true;

      setIsCameraReady(true);

      console.log("Camera ready:", video.videoWidth, "x", video.videoHeight);
    } catch (error) {
      console.error("Camera error:", error);

      cameraReadyRef.current = false;

      setIsCameraReady(false);

      // Pesan error dibuat spesifik supaya user tahu cara memperbaikinya.
      const name = error instanceof DOMException ? error.name : "";
      const message = error instanceof Error ? error.message : "";

      if (message === "INSECURE_CONTEXT") {
        setCameraError(
          "Kamera hanya bisa dipakai lewat HTTPS atau localhost. Buka aplikasi dengan alamat HTTPS.",
        );
      } else if (name === "NotAllowedError") {
        setCameraError(
          "Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser, lalu coba lagi.",
        );
      } else if (name === "NotFoundError") {
        setCameraError("Kamera tidak ditemukan di perangkat ini.");
      } else {
        setCameraError(
          "Kamera tidak dapat diakses. Pastikan tidak dipakai aplikasi lain, lalu coba lagi.",
        );
      }
    }
  }, []);

  // =========================================================
  // CAPTURE & SEND FRAME
  // =========================================================

  const captureAndSendFrame = useCallback(() => {
    const video = videoRef.current;

    const canvas = canvasRef.current;

    const socket = wsRef.current;

    // -------------------------------------------------------
    // VALIDATION
    // -------------------------------------------------------

    if (!video || !canvas || !socket) {
      return;
    }

    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }

    if (!cameraReadyRef.current) {
      return;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    /**
     * Backpressure.
     *
     * Jangan kirim frame baru sebelum backend
     * selesai dengan frame sebelumnya.
     */
    if (processingRef.current) {
      return;
    }

    processingRef.current = true;

    // -------------------------------------------------------
    // SET CANVAS SIZE
    // -------------------------------------------------------

    canvas.width = video.videoWidth;

    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      processingRef.current = false;
      return;
    }

    // -------------------------------------------------------
    // DRAW CAMERA FRAME
    // -------------------------------------------------------

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // -------------------------------------------------------
    // CONVERT TO JPEG
    // -------------------------------------------------------

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          processingRef.current = false;
          return;
        }

        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          processingRef.current = false;
          return;
        }

        try {
          sentAtRef.current = performance.now();

          wsRef.current.send(blob);

          console.log("Frame sent:", Math.round(blob.size / 1024), "KB");
        } catch (error) {
          console.error("Failed to send frame:", error);

          processingRef.current = false;
        }
      },
      "image/jpeg",
      0.82,
    );
  }, []);

  // =========================================================
  // RETRY CAMERA (tombol "Try again" saat kamera gagal)
  // =========================================================

  const retryCamera = useCallback(async () => {
    await initCamera();

    if (destroyedRef.current) {
      return;
    }

    window.setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        captureAndSendFrame();
      }
    }, 300);
  }, [initCamera, captureAndSendFrame]);

  // =========================================================
  // CLEAR RECONNECT TIMER
  // =========================================================

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);

      reconnectTimerRef.current = null;
    }
  }, []);

  // =========================================================
  // SCHEDULE RECONNECT
  // =========================================================

  const scheduleReconnect = useCallback(() => {
    if (destroyedRef.current) {
      return;
    }

    clearReconnectTimer();

    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;

      if (destroyedRef.current) {
        return;
      }

      connectWebSocket();
    }, 3000);
  }, [clearReconnectTimer]);
  // =========================================================
  // CONNECT WEBSOCKET
  // =========================================================

  const connectWebSocket = useCallback(() => {
    console.log("CONNECT WEBSOCKET START");
    console.log("TARGET:", WS_URL);

    setDebugMessage(`CONNECTING: ${WS_URL}`);

    if (destroyedRef.current) {
      return;
    }

    // Jangan membuat koneksi kedua
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      console.log("WebSocket masih aktif, tidak membuat koneksi baru.");
      return;
    }

    clearReconnectTimer();

    let socket: WebSocket;

    try {
      socket = new WebSocket(WS_URL);
    } catch (error) {
      console.error("Gagal membuat WebSocket:", error);

      setIsConnected(false);

      reconnectTimerRef.current = window.setTimeout(() => {
        if (!destroyedRef.current) {
          connectWebSocket();
        }
      }, 3000);

      return;
    }

    wsRef.current = socket;

    socket.binaryType = "blob";

    // =========================================================
    // OPEN
    // =========================================================

    socket.onopen = async () => {
      console.log("WEBSOCKET OPEN");
      setDebugMessage("WEBSOCKET OPEN");

      setIsConnected(true);

      showToast("success", "Terhubung ke server");

      clearReconnectTimer();

      try {
        // Backend selalu mulai dengan mode "both" di koneksi baru,
        // jadi kirim ulang mode terakhir yang dipilih user.
        socket.send(JSON.stringify({ mode: modeRef.current }));

        // Kamera dimulai setelah WebSocket berhasil
        await initCamera();

        if (destroyedRef.current) {
          return;
        }

        window.setTimeout(() => {
          if (destroyedRef.current) {
            return;
          }

          if (wsRef.current?.readyState !== WebSocket.OPEN) {
            return;
          }

          captureAndSendFrame();
        }, 500);
      } catch (error) {
        console.error("Gagal menginisialisasi kamera:", error);
      }
    };

    // =========================================================
    // MESSAGE
    // =========================================================

    socket.onmessage = (event) => {
      let data: ServerMessage;

      try {
        data = JSON.parse(event.data);
      } catch (error) {
        console.error("Gagal parse response WebSocket:", error);

        // Lepas lock supaya stream tidak macet
        processingRef.current = false;

        requestAnimationFrame(() => {
          if (!destroyedRef.current) {
            captureAndSendFrame();
          }
        });

        return;
      }

      // -----------------------------------------------
      // KONFIRMASI MODE
      //
      // Ini BUKAN hasil frame, jadi jangan reset
      // processingRef dan jangan kirim frame baru.
      // Kalau tidak, dua frame bisa ada di antrean backend.
      // -----------------------------------------------

      if (isModeChangedMessage(data)) {
        console.log("Mode dikonfirmasi backend:", data.current_mode);

        setDebugMessage(`MODE: ${data.current_mode}`);

        return;
      }

      try {
        // -----------------------------------------------
        // IMAGE
        // -----------------------------------------------

        if (data.image) {
          const imageSrc = data.image.startsWith("data:image")
            ? data.image
            : `data:image/jpeg;base64,${data.image}`;

          setAnnotatedImage(imageSrc);
        }

        // -----------------------------------------------
        // COUNTS
        // -----------------------------------------------

        setCounts({
          model1: Number(data.model_1_count ?? 0),

          model2: Number(data.model_2_count ?? 0),
        });

        // -----------------------------------------------
        // LAST UPDATE
        // -----------------------------------------------

        setLastUpdate(new Date());

        // -----------------------------------------------
        // FPS & LATENCY (dirata-rata per 1 detik)
        // -----------------------------------------------

        const now = performance.now();

        const windowStats = perfWindowRef.current;

        if (windowStats.start === 0) {
          windowStats.start = now;
        }

        windowStats.count += 1;

        if (sentAtRef.current > 0) {
          windowStats.latencySum += now - sentAtRef.current;
        }

        const elapsed = now - windowStats.start;

        if (elapsed >= 1000) {
          setPerf({
            fps: (windowStats.count * 1000) / elapsed,
            latencyMs: windowStats.latencySum / windowStats.count,
          });

          perfWindowRef.current = { start: now, count: 0, latencySum: 0 };
        }
      } catch (error) {
        console.error("Gagal memproses hasil deteksi:", error);
      } finally {
        // Backend sudah selesai memproses frame
        processingRef.current = false;

        // Kirim frame berikutnya
        requestAnimationFrame(() => {
          if (destroyedRef.current) {
            return;
          }

          captureAndSendFrame();
        });
      }
    };

    // =========================================================
    // ERROR
    // =========================================================

    socket.onerror = (error) => {
      console.error("WEBSOCKET ERROR:", error);
      setDebugMessage("WEBSOCKET ERROR");
      setIsConnected(false);
    };

    // =========================================================
    // CLOSE
    // =========================================================

    socket.onclose = (event) => {
      console.log(
        "WEBSOCKET CLOSED",
        event.code,
        event.reason || "(no reason)",
      );
      setDebugMessage(`CLOSED ${event.code} ${event.reason || ""}`);

      setIsConnected(false);

      processingRef.current = false;

      perfWindowRef.current = { start: 0, count: 0, latencySum: 0 };

      setPerf(null);

      stopCamera();

      // Pastikan ref menunjuk ke socket yang benar
      if (wsRef.current === socket) {
        wsRef.current = null;
      }

      // Jangan reconnect setelah component dihancurkan
      if (destroyedRef.current) {
        return;
      }

      showToast("warning", "Koneksi terputus. Menyambung ulang...");

      // Reconnect 3 detik kemudian
      clearReconnectTimer();

      reconnectTimerRef.current = window.setTimeout(() => {
        if (destroyedRef.current) {
          return;
        }

        connectWebSocket();
      }, 3000);
    };
  }, [
    clearReconnectTimer,
    initCamera,
    captureAndSendFrame,
    stopCamera,
    showToast,
  ]);

  // =========================================================
  // MANUAL RECONNECT
  // =========================================================

  const reconnect = useCallback(() => {
    console.log("Manual reconnect...");

    clearReconnectTimer();

    processingRef.current = false;

    stopCamera();

    const socket = wsRef.current;

    /**
     * Kalau socket masih aktif, tutup.
     * onclose akan memanggil scheduleReconnect().
     */
    scheduleReconnect();

    if (
      socket &&
      (socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING)
    ) {
      socket.close();

      return;
    }

    wsRef.current = null;

    /**
     * Kalau socket sudah tidak aktif,
     * connect langsung.
     */
    window.setTimeout(() => {
      if (!destroyedRef.current) {
        connectWebSocket();
      }
    }, 300);
  }, [scheduleReconnect, clearReconnectTimer, connectWebSocket, stopCamera]);

  // =========================================================
  // FULLSCREEN
  // =========================================================

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();

        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();

        setIsFullscreen(false);
      }
    } catch (error) {
      console.error("Fullscreen error:", error);
    }
  }, []);

  // =========================================================
  // FULLSCREEN CHANGE LISTENER
  // =========================================================

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement !== null);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // =========================================================
  // INITIAL CONNECTION
  // =========================================================

  useEffect(() => {
    destroyedRef.current = false;

    connectWebSocket();

    return () => {
      console.log("App component unmounting");

      destroyedRef.current = true;

      clearReconnectTimer();

      processingRef.current = false;

      stopCamera();

      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;

        wsRef.current.close();

        wsRef.current = null;
      }
    };
  }, [connectWebSocket, clearReconnectTimer, stopCamera]);

  // =========================================================
  // DERIVED
  // =========================================================

  const ModeIcon = mode === "both" ? Layers : ScanLine;

  const modeIconClass =
    mode === "model_1"
      ? "text-emerald-400"
      : mode === "model_2"
        ? "text-red-400"
        : "text-white/70";

  const fullscreenLabel = isFullscreen ? "Exit fullscreen" : "Fullscreen";

  // Aksi berlabel, dipakai di drawer mobile
  const detailActions = (
    <div className="mt-5 grid grid-cols-2 gap-2">
      <Button variant="secondary" onClick={toggleFullscreen}>
        {isFullscreen ? <Minimize /> : <Maximize />}

        <span>{fullscreenLabel}</span>
      </Button>

      <Button
        variant="secondary"
        onClick={() => {
          setDetailsOpen(false);
          reconnect();
        }}
      >
        <RefreshCw />
        Reconnect
      </Button>
    </div>
  );

  // =========================================================
  // UI
  // =========================================================

  return (
    <main
      translate="no"
      className="notranslate fixed inset-0 flex overflow-hidden bg-slate-950 text-white antialiased"
      style={{ fontFamily: FONT_STACK }}
    >
      {/* =====================================================
          HIDDEN CAMERA
      ===================================================== */}

      <video ref={videoRef} muted playsInline autoPlay className="hidden" />

      <canvas ref={canvasRef} className="hidden" />
      <ChatWidget />
      {/* =====================================================
          DESKTOP SIDEBAR
      ===================================================== */}

      <aside className="hidden w-80 shrink-0 flex-col border-r border-white/10 bg-slate-950 lg:flex">
        <div className="flex items-center justify-between gap-3 p-5">
          <Brand />

          <StatusPill isConnected={isConnected} />
        </div>

        <Separator />

        <div className="flex-1 space-y-7 overflow-y-auto p-5">
          <DetectionSummary counts={counts} mode={mode} />

          <Separator />

          <section>
            <h2 className="mb-3 text-sm font-medium text-white/80">
              Detection mode
            </h2>

            <ModeSelector mode={mode} onChange={changeMode} />

            <p className="mt-3 text-xs leading-relaxed text-white/45">
              {MODE_DESCRIPTIONS[mode]}
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="mb-4 text-sm font-medium text-white/80">System</h2>

            <SystemStatus
              isConnected={isConnected}
              isCameraReady={isCameraReady}
              lastUpdate={lastUpdate}
              perf={perf}
              debugMessage={debugMessage}
            />
          </section>
        </div>
      </aside>

      {/* =====================================================
          STAGE
      ===================================================== */}

      <section className="relative min-w-0 flex-1 bg-black">
        {/* CAMERA / DETECTION VIEW */}

        <div className="absolute inset-0 flex items-center justify-center">
          {annotatedImage ? (
            <img
              src={annotatedImage}
              alt="Live AI detection"
              draggable={false}
              className="h-full w-full select-none object-contain"
            />
          ) : (
            <div className="flex max-w-sm flex-col items-center px-6 text-center">
              {cameraError ? (
                <>
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10 text-amber-300">
                    <CameraOff className="h-6 w-6" />
                  </div>

                  <h2 className="text-lg font-semibold tracking-tight">
                    Camera unavailable
                  </h2>

                  <p className="mt-2 text-sm leading-relaxed text-white/55">
                    {cameraError}
                  </p>

                  <Button className="mt-6" onClick={retryCamera}>
                    <RefreshCw />
                    Try again
                  </Button>
                </>
              ) : !isConnected ? (
                <>
                  <CircularProgress
                    size={30}
                    thickness={4}
                    color="inherit"
                    className="mb-5 text-white/70"
                  />

                  <h2 className="text-lg font-semibold tracking-tight">
                    Connecting to server
                  </h2>

                  <p className="mt-2 break-all text-sm text-white/45">
                    {WS_URL}
                  </p>
                </>
              ) : (
                <>
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70">
                    <ScanSearch className="h-6 w-6" />
                  </div>

                  <h2 className="text-lg font-semibold tracking-tight">
                    Waiting for detection
                  </h2>

                  <p className="mt-2 text-sm text-white/45">
                    Arahkan kamera ke objek. Hasil akan muncul di sini.
                  </p>

                  <LinearProgress
                    color="inherit"
                    className="mt-6 w-40 rounded-full text-white/60"
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* SOFT EDGE SHADE, supaya kontrol tetap terbaca di atas video */}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60" />

        {/* VIEWFINDER */}

        <Viewfinder mode={mode} />

        {/* TOP BAR */}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:p-6">
          {/* Mobile: brand */}
          <div className="pointer-events-auto rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 backdrop-blur-xl lg:hidden">
            <Brand />
          </div>

          {/* Desktop: mode aktif */}
          <div className="pointer-events-auto hidden lg:block">
            <Badge className="gap-2 bg-slate-950/60 py-1.5 pl-2.5 pr-3 backdrop-blur-xl">
              <ModeIcon className={`h-4 w-4 ${modeIconClass}`} />

              <span>{MODE_SUMMARY[mode]}</span>
            </Badge>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            {/* Mobile: status */}
            <StatusPill
              isConnected={isConnected}
              className="bg-slate-950/60 backdrop-blur-xl lg:hidden"
            />

            {/* Desktop: fps + aksi */}
            {perf && (
              <Badge className="hidden gap-1.5 bg-slate-950/60 py-1.5 backdrop-blur-xl tabular-nums lg:inline-flex">
                <Gauge />
                {perf.fps.toFixed(1)} fps
              </Badge>
            )}

            <div className="hidden items-center gap-2 lg:flex">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="bg-slate-950/60 backdrop-blur-xl"
                    onClick={toggleFullscreen}
                    aria-label={fullscreenLabel}
                  >
                    {isFullscreen ? <Minimize /> : <Maximize />}
                  </Button>
                </TooltipTrigger>

                <TooltipContent>{fullscreenLabel}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="bg-slate-950/60 backdrop-blur-xl"
                    onClick={reconnect}
                    aria-label="Reconnect"
                  >
                    <RefreshCw />
                  </Button>
                </TooltipTrigger>

                <TooltipContent>Reconnect</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* MOBILE DOCK + DRAWER (MUI) */}

        <MobileDock
          counts={counts}
          mode={mode}
          onModeChange={changeMode}
          open={detailsOpen}
          onOpen={() => setDetailsOpen(true)}
          onClose={() => setDetailsOpen(false)}
        >
          <SystemStatus
            isConnected={isConnected}
            isCameraReady={isCameraReady}
            lastUpdate={lastUpdate}
            perf={perf}
            debugMessage={debugMessage}
          />

          <p className="mt-4 text-xs leading-relaxed text-white/45">
            {MODE_DESCRIPTIONS[mode]}
          </p>

          {detailActions}
        </MobileDock>
      </section>

      {/* =====================================================
          TOAST (MUI Snackbar)
      ===================================================== */}

      <Snackbar
        open={toast.open}
        autoHideDuration={2400}
        onClose={closeToast}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{ top: { xs: 84, lg: 24 } }}
      >
        <Alert
          severity={toast.severity}
          variant="outlined"
          onClose={closeToast}
          sx={{
            alignItems: "center",
            borderRadius: "16px",
            backgroundColor: "rgba(2, 6, 23, 0.88)",
            backdropFilter: "blur(16px)",
            fontSize: 13,
          }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </main>
  );
}
