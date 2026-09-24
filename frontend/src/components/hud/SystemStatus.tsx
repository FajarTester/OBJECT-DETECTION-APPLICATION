import type { ReactNode } from "react";
import {
  Camera,
  CameraOff,
  Clock,
  Gauge,
  Terminal,
  Timer,
  Wifi,
  WifiOff,
  type LucideIcon,
} from "lucide-react";

import { cn } from "../../lib/utils";
import type { PerfStats } from "../../types";

interface SystemStatusProps {
  isConnected: boolean;
  isCameraReady: boolean;
  lastUpdate: Date | null;
  perf: PerfStats | null;
  debugMessage: string;
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2.5 text-white/50">
        <Icon className="h-4 w-4" />

        {label}
      </div>

      <div className="font-medium tabular-nums">{children}</div>
    </div>
  );
}

export function SystemStatus({
  isConnected,
  isCameraReady,
  lastUpdate,
  perf,
  debugMessage,
}: SystemStatusProps) {
  return (
    <div className="space-y-3.5">
      <Row icon={isConnected ? Wifi : WifiOff} label="Server">
        <span className={isConnected ? "text-emerald-400" : "text-red-400"}>
          {isConnected ? "Connected" : "Offline"}
        </span>
      </Row>

      <Row icon={isCameraReady ? Camera : CameraOff} label="Camera">
        <span className={isCameraReady ? "text-emerald-400" : "text-amber-400"}>
          {isCameraReady ? "Ready" : "Waiting"}
        </span>
      </Row>

      <Row icon={Gauge} label="Frame rate">
        <span className={cn(!perf && "text-white/40")}>
          {perf ? `${perf.fps.toFixed(1)} fps` : "–"}
        </span>
      </Row>

      <Row icon={Timer} label="Latency">
        <span className={cn(!perf && "text-white/40")}>
          {perf ? `${Math.round(perf.latencyMs)} ms` : "–"}
        </span>
      </Row>

      <Row icon={Clock} label="Last frame">
        <span className={cn(!lastUpdate && "text-white/40")}>
          {lastUpdate ? lastUpdate.toLocaleTimeString() : "--:--:--"}
        </span>
      </Row>

      <div className="flex items-start gap-2.5 rounded-xl bg-white/[0.04] px-3 py-2.5 text-xs text-white/45">
        <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0" />

        <span className="break-all">{debugMessage}</span>
      </div>
    </div>
  );
}
