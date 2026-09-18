import { useCallback, useEffect, useRef, useState } from "react";

interface DetectionResult {
  image: string;
  model_1_count: number;
  model_2_count: number;
}

const WS_URL =
  import.meta.env.VITE_WS_URL ?? "ws://192.168.18.7:8000/ws/stream";

console.log("APP STARTED");
console.log("WS URL:", WS_URL);

export default function App() {
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

  // =========================================================
  // STATE
  // =========================================================

  const [annotatedImage, setAnnotatedImage] = useState<string | null>(null);

  const [counts, setCounts] = useState({
    model1: 0,
    model2: 0,
  });

  const [isConnected, setIsConnected] = useState(false);

  const [isCameraReady, setIsCameraReady] = useState(false);

  const [cameraError, setCameraError] = useState<string | null>(null);

  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const [debugMessage, setDebugMessage] = useState("APP STARTING");

  const totalObjects = counts.model1 + counts.model2;

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

      if (!navigator.mediaDevices) {
        throw new Error("navigator.mediaDevices tidak tersedia.");
      }

      if (!navigator.mediaDevices.getUserMedia) {
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

      setCameraError(
        "Kamera tidak dapat diakses. Pastikan permission kamera sudah diberikan.",
      );
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

    console.log("====================================");
    console.log("CONNECT WEBSOCKET START");
    console.log("TARGET:", WS_URL);
    console.log("====================================");

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
      console.log("====================================");
      console.log("TARGET:", WS_URL);
      console.log("WEBSOCKET OPEN");
      setDebugMessage("WEBSOCKET OPEN");
      console.log("====================================");

      setIsConnected(true);

      clearReconnectTimer();

      setIsConnected(true);

      try {
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
      try {
        const data: DetectionResult = JSON.parse(event.data);

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
      } catch (error) {
        console.error("Gagal parse response WebSocket:", error);
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
      console.log("====================================");

      console.log("WEBSOCKET CLOSED");

      console.log("CODE:", event.code);

      console.log("REASON:", event.reason || "(no reason)");

      console.log("WEBSOCKET CLOSED", event.code, event.reason);
      setDebugMessage(`CLOSED ${event.code} ${event.reason || ""}`);

      console.log("====================================");

      setIsConnected(false);

      processingRef.current = false;

      stopCamera();

      // Pastikan ref menunjuk ke socket yang benar
      if (wsRef.current === socket) {
        wsRef.current = null;
      }

      // Jangan reconnect setelah component dihancurkan
      if (destroyedRef.current) {
        return;
      }

      // Reconnect 3 detik kemudian
      clearReconnectTimer();

      reconnectTimerRef.current = window.setTimeout(() => {
        if (destroyedRef.current) {
          return;
        }

        connectWebSocket();
      }, 3000);
    };
  }, [clearReconnectTimer, initCamera, captureAndSendFrame, stopCamera]);

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
  // UI
  // =========================================================

  return (
    <main className="fixed inset-0 overflow-hidden bg-slate-950 text-white">
      {/* =====================================================
          HIDDEN CAMERA
      ===================================================== */}

      <video ref={videoRef} muted playsInline autoPlay className="hidden" />

      <canvas ref={canvasRef} className="hidden" />

      {/* =====================================================
          CAMERA / DETECTION VIEW
      ===================================================== */}

      <div className="absolute inset-0 flex items-center justify-center bg-black">
        {annotatedImage ? (
          <img
            src={annotatedImage}
            alt="Live AI Detection"
            className="
              h-full
              w-full
              object-contain
              select-none
            "
          />
        ) : (
          <div
            className="
            flex
            flex-col
            items-center
            justify-center
            px-6
            text-center
          "
          >
            {/* CAMERA ICON */}

            <div
              className="
              mb-5
              flex
              h-16
              w-16
              items-center
              justify-center
              rounded-2xl
              border
              border-white/10
              bg-white/5
            "
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                className="h-7 w-7 text-white/70"
              >
                <path
                  d="M4 7h3l2-2h6l2 2h3v11H4z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>

            <h2
              className="
              text-xl
              font-bold
              tracking-tight
            "
            >
              Vision Detection
            </h2>

            <p
              className="
              mt-2
              max-w-sm
              text-sm
              text-white/50
            "
            >
              {cameraError
                ? cameraError
                : isConnected
                  ? "Kamera siap. Menunggu hasil deteksi..."
                  : "Menghubungkan ke detection server..."}
            </p>

            {/* STATUS */}

            <div
              className="
              mt-5
              flex
              items-center
              gap-2
              rounded-full
              border
              border-white/10
              bg-white/5
              px-4
              py-2
              text-xs
              text-white/60
            "
            >
              <span
                className={`
                  h-2
                  w-2
                  rounded-full
                  ${isConnected ? "animate-pulse bg-emerald-400" : "bg-red-400"}
                `}
              />

              {isConnected ? "Server Connected" : "Server Offline"}
            </div>
          </div>
        )}
      </div>

      {/* =====================================================
          DARK OVERLAY
      ===================================================== */}

      <div
        className="
        pointer-events-none
        absolute
        inset-0
        bg-gradient-to-b
        from-black/55
        via-transparent
        to-black/80
      "
      />

      {/* =====================================================
          TOP HEADER
      ===================================================== */}

      <header
        className="
        absolute
        left-0
        right-0
        top-0
        z-30
        p-3
        sm:p-4
      "
      >
        <div className="absolute left-3 top-20 z-50 max-w-[90%] rounded-xl bg-black/80 px-3 py-2 text-xs text-white">
          {debugMessage}
        </div>

        <div
          className="
          mx-auto
          flex
          max-w-7xl
          items-center
          justify-between
          rounded-2xl
          border
          border-white/10
          bg-black/45
          px-3
          py-2.5
          shadow-xl
          backdrop-blur-xl
          sm:px-4
          sm:py-3
        "
        >
          {/* BRAND */}

          <div className="flex items-center gap-3">
            <div
              className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-xl
              bg-white
              text-slate-950
              shadow-lg
              sm:h-10
              sm:w-10
            "
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
              >
                <path
                  d="M4 7h3l2-2h6l2 2h3v11H4z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>

            <div>
              <h1
                className="
                text-sm
                font-bold
                tracking-tight
                sm:text-base
              "
              >
                Vision Detection
              </h1>

              <p
                className="
                text-[10px]
                text-white/40
                sm:text-[11px]
              "
              >
                AI Object Monitoring
              </p>
            </div>
          </div>

          {/* RIGHT CONTROLS */}

          <div className="flex items-center gap-2">
            {/* CONNECTION */}

            <div
              className="
              flex
              items-center
              gap-2
              rounded-full
              border
              border-white/10
              bg-white/5
              px-3
              py-1.5
            "
            >
              <span
                className={`
                  h-2
                  w-2
                  rounded-full
                  ${isConnected ? "animate-pulse bg-emerald-400" : "bg-red-400"}
                `}
              />

              <span
                className="
                text-[11px]
                font-semibold
                sm:text-xs
              "
              >
                {isConnected ? "LIVE" : "OFFLINE"}
              </span>
            </div>

            {/* FULLSCREEN */}

            <button
              type="button"
              onClick={toggleFullscreen}
              className="
                hidden
                h-9
                w-9
                items-center
                justify-center
                rounded-xl
                border
                border-white/10
                bg-white/5
                transition
                hover:bg-white/10
                active:scale-95
                sm:flex
              "
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <path d="M9 9H4V4" />
                  <path d="M15 9h5V4" />
                  <path d="M9 15H4v5" />
                  <path d="M15 15h5v5" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <path d="M4 9V4h5" />
                  <path d="M15 4h5v5" />
                  <path d="M20 15v5h-5" />
                  <path d="M9 20H4v-5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* =====================================================
          DESKTOP PANEL
      ===================================================== */}

      <aside
        className="
        absolute
        bottom-5
        left-5
        top-24
        z-20
        hidden
        w-72
        flex-col
        gap-3
        lg:flex
      "
      >
        {/* DETECTION SUMMARY */}

        <div
          className="
          rounded-3xl
          border
          border-white/10
          bg-black/50
          p-5
          shadow-xl
          backdrop-blur-xl
        "
        >
          <div
            className="
            flex
            items-end
            justify-between
          "
          >
            <div>
              <p
                className="
                text-[10px]
                font-medium
                uppercase
                tracking-[0.2em]
                text-white/40
              "
              >
                Detection
              </p>

              <h2
                className="
                mt-1
                text-xl
                font-bold
              "
              >
                Live Monitor
              </h2>
            </div>

            <div
              className="
              rounded-xl
              bg-white/5
              px-3
              py-2
              text-right
            "
            >
              <p
                className="
                text-[9px]
                uppercase
                text-white/40
              "
              >
                Total
              </p>

              <p
                className="
                text-xl
                font-bold
              "
              >
                {totalObjects}
              </p>
            </div>
          </div>
        </div>

        {/* MODEL 1 */}

        <div
          className="
          rounded-3xl
          border
          border-emerald-400/20
          bg-black/50
          p-5
          shadow-xl
          backdrop-blur-xl
        "
        >
          <div
            className="
            flex
            items-center
            justify-between
          "
          >
            <div
              className="
              flex
              items-center
              gap-3
            "
            >
              <span
                className="
                h-3
                w-3
                rounded-full
                bg-emerald-400
              "
              />

              <span
                className="
                text-sm
                text-white/70
              "
              >
                Model 1
              </span>
            </div>

            <span
              className="
              text-3xl
              font-bold
              text-emerald-400
            "
            >
              {counts.model1}
            </span>
          </div>

          <p
            className="
            mt-3
            text-xs
            text-white/40
          "
          >
            Green detection
          </p>
        </div>

        {/* MODEL 2 */}

        <div
          className="
          rounded-3xl
          border
          border-red-400/20
          bg-black/50
          p-5
          shadow-xl
          backdrop-blur-xl
        "
        >
          <div
            className="
            flex
            items-center
            justify-between
          "
          >
            <div
              className="
              flex
              items-center
              gap-3
            "
            >
              <span
                className="
                h-3
                w-3
                rounded-full
                bg-red-400
              "
              />

              <span
                className="
                text-sm
                text-white/70
              "
              >
                Model 2
              </span>
            </div>

            <span
              className="
              text-3xl
              font-bold
              text-red-400
            "
            >
              {counts.model2}
            </span>
          </div>

          <p
            className="
            mt-3
            text-xs
            text-white/40
          "
          >
            Red detection
          </p>
        </div>

        {/* SYSTEM */}

        <div
          className="
          rounded-3xl
          border
          border-white/10
          bg-black/50
          p-5
          shadow-xl
          backdrop-blur-xl
        "
        >
          <p
            className="
            text-[10px]
            font-medium
            uppercase
            tracking-[0.2em]
            text-white/40
          "
          >
            System
          </p>

          <div
            className="
            mt-4
            space-y-3
          "
          >
            <div
              className="
              flex
              items-center
              justify-between
              text-xs
            "
            >
              <span className="text-white/40">WebSocket</span>

              <span
                className={isConnected ? "text-emerald-400" : "text-red-400"}
              >
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>

            <div
              className="
              flex
              items-center
              justify-between
              text-xs
            "
            >
              <span className="text-white/40">Camera</span>

              <span
                className={
                  isCameraReady ? "text-emerald-400" : "text-amber-400"
                }
              >
                {isCameraReady ? "Ready" : "Waiting"}
              </span>
            </div>

            <div
              className="
              flex
              items-center
              justify-between
              text-xs
            "
            >
              <span className="text-white/40">Last Frame</span>

              <span className="text-white/70">
                {lastUpdate ? lastUpdate.toLocaleTimeString() : "--:--:--"}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* =====================================================
          MOBILE BOTTOM PANEL
      ===================================================== */}

      <section
        className="
        absolute
        bottom-0
        left-0
        right-0
        z-30
        p-3
        lg:hidden
      "
      >
        <div
          className="
          rounded-[28px]
          border
          border-white/10
          bg-black/65
          p-4
          shadow-2xl
          backdrop-blur-2xl
        "
        >
          {/* HANDLE */}

          <div
            className="
            mx-auto
            mb-4
            h-1
            w-10
            rounded-full
            bg-white/20
          "
          />

          {/* HEADER */}

          <div
            className="
            mb-4
            flex
            items-center
            justify-between
          "
          >
            <div>
              <p
                className="
                text-[9px]
                font-medium
                uppercase
                tracking-[0.2em]
                text-white/40
              "
              >
                Live Detection
              </p>

              <h2
                className="
                mt-1
                text-lg
                font-bold
              "
              >
                {totalObjects} Objects
              </h2>
            </div>

            <div
              className="
              flex
              items-center
              gap-2
              rounded-full
              bg-white/5
              px-3
              py-2
            "
            >
              <span
                className={`
                  h-2
                  w-2
                  rounded-full
                  ${isConnected ? "animate-pulse bg-emerald-400" : "bg-red-400"}
                `}
              />

              <span
                className="
                text-[10px]
                font-semibold
              "
              >
                {isConnected ? "LIVE" : "OFFLINE"}
              </span>
            </div>
          </div>

          {/* COUNTERS */}

          <div
            className="
            grid
            grid-cols-2
            gap-2
          "
          >
            {/* MODEL 1 */}

            <div
              className="
              rounded-2xl
              border
              border-emerald-400/20
              bg-emerald-400/5
              p-4
            "
            >
              <div
                className="
                flex
                items-center
                gap-2
              "
              >
                <span
                  className="
                  h-2
                  w-2
                  rounded-full
                  bg-emerald-400
                  "
                />

                <span
                  className="
                  text-[11px]
                  text-white/50
                "
                >
                  Model 1
                </span>
              </div>

              <p
                className="
                mt-1
                text-2xl
                font-bold
                text-emerald-400
              "
              >
                {counts.model1}
              </p>
            </div>

            {/* MODEL 2 */}

            <div
              className="
              rounded-2xl
              border
              border-red-400/20
              bg-red-400/5
              p-4
            "
            >
              <div
                className="
                flex
                items-center
                gap-2
              "
              >
                <span
                  className="
                  h-2
                  w-2
                  rounded-full
                  bg-red-400
                  "
                />

                <span
                  className="
                  text-[11px]
                  text-white/50
                "
                >
                  Model 2
                </span>
              </div>

              <p
                className="
                mt-1
                text-2xl
                font-bold
                text-red-400
              "
              >
                {counts.model2}
              </p>
            </div>
          </div>

          {/* STATUS */}

          <div
            className="
            mt-2
            flex
            items-center
            justify-between
            rounded-2xl
            border
            border-white/10
            bg-white/5
            px-4
            py-3
          "
          >
            <div
              className="
              flex
              items-center
              gap-2
            "
            >
              <span
                className={`
                  h-2
                  w-2
                  rounded-full
                  ${isCameraReady ? "bg-emerald-400" : "bg-amber-400"}
                `}
              />

              <span
                className="
                text-xs
                text-white/60
              "
              >
                Camera
              </span>
            </div>

            <span
              className="
              text-xs
              font-semibold
            "
            >
              {isCameraReady ? "Ready" : "Waiting"}
            </span>
          </div>

          {/* BUTTONS */}

          <div
            className="
            mt-2
            grid
            grid-cols-2
            gap-2
          "
          >
            <button
              type="button"
              onClick={toggleFullscreen}
              className="
                rounded-2xl
                border
                border-white/10
                bg-white/10
                py-3
                text-xs
                font-semibold
                transition
                active:scale-[0.98]
              "
            >
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </button>

            <button
              type="button"
              onClick={reconnect}
              className="
                rounded-2xl
                border
                border-white/10
                bg-white/10
                py-3
                text-xs
                font-semibold
                transition
                active:scale-[0.98]
              "
            >
              Reconnect
            </button>
          </div>
        </div>
      </section>

      {/* =====================================================
          DESKTOP FOOTER
      ===================================================== */}

      <div
        className="
        absolute
        bottom-5
        right-5
        z-20
        hidden
        items-center
        gap-2
        rounded-full
        border
        border-white/10
        bg-black/40
        px-4
        py-2
        text-xs
        text-white/50
        backdrop-blur-xl
        lg:flex
      "
      >
        <span
          className="
          h-1.5
          w-1.5
          rounded-full
          bg-emerald-400
          "
        />
        AI Detection Engine
        <span className="text-white/20">•</span>
        {lastUpdate ? lastUpdate.toLocaleTimeString() : "Waiting..."}
      </div>
    </main>
  );
}
