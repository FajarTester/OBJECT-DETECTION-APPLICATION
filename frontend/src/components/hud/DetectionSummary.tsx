import { ScanLine } from "lucide-react";

import { cn } from "../../lib/utils";
import type { Counts, DetectionMode } from "../../types";

interface DetectionSummaryProps {
  counts: Counts;
  mode: DetectionMode;
}

interface ModelRowProps {
  name: string;
  hint: string;
  value: number;
  active: boolean;
  tile: string;
  valueClass: string;
}

function ModelRow({
  name,
  hint,
  value,
  active,
  tile,
  valueClass,
}: ModelRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition-opacity",
        !active && "opacity-45",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          tile,
        )}
      >
        <ScanLine className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-sm font-medium">{name}</p>

        <p className="mt-0.5 text-xs text-white/45">{hint}</p>
      </div>

      {active ? (
        <span
          className={cn("text-2xl font-semibold tabular-nums", valueClass)}
        >
          {value}
        </span>
      ) : (
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/50">
          Off
        </span>
      )}
    </div>
  );
}

export function DetectionSummary({ counts, mode }: DetectionSummaryProps) {
  const model1Active = mode !== "model_2";
  const model2Active = mode !== "model_1";

  const c1 = model1Active ? counts.model1 : 0;
  const c2 = model2Active ? counts.model2 : 0;
  const total = c1 + c2;

  const share1 = total > 0 ? (c1 / total) * 100 : 0;
  const share2 = total > 0 ? (c2 / total) * 100 : 0;

  return (
    <div>
      <p className="text-sm text-white/50">Objects detected</p>

      <p className="mt-1 text-6xl font-semibold leading-none tracking-tight tabular-nums">
        {total}
      </p>

      {/* Proporsi hijau vs merah, warnanya sama dengan kotak di video */}
      <div
        className="mt-5 flex h-2 overflow-hidden rounded-full bg-white/10"
        role="img"
        aria-label={`Model 1: ${c1}, Model 2: ${c2}`}
      >
        <div
          className="h-full bg-emerald-400 transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${share1}%` }}
        />

        <div
          className="h-full bg-red-400 transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${share2}%` }}
        />
      </div>

      <div className="mt-4 space-y-2">
        <ModelRow
          name="Model 1"
          hint="Green boxes"
          value={counts.model1}
          active={model1Active}
          tile="bg-emerald-400/15 text-emerald-400"
          valueClass="text-emerald-400"
        />

        <ModelRow
          name="Model 2"
          hint="Red boxes"
          value={counts.model2}
          active={model2Active}
          tile="bg-red-400/15 text-red-400"
          valueClass="text-red-400"
        />
      </div>
    </div>
  );
}
