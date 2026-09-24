import { cn } from "../../lib/utils";
import type { DetectionMode } from "../../types";

/**
 * Warna sudut bracket mengikuti mode aktif:
 * hijau = Model 1, merah = Model 2, putih = keduanya.
 */
const TONE: Record<DetectionMode, string> = {
  model_1: "border-emerald-400/70",
  model_2: "border-red-400/70",
  both: "border-white/60",
};

const CORNER = "absolute h-9 w-9 transition-colors duration-300";

export function Viewfinder({ mode }: { mode: DetectionMode }) {
  const tone = TONE[mode];

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-3 bottom-[14.5rem] top-[4.75rem] z-10 lg:inset-3"
    >
      <span
        className={cn(CORNER, tone, "left-0 top-0 rounded-tl-2xl border-l-2 border-t-2")}
      />
      <span
        className={cn(CORNER, tone, "right-0 top-0 rounded-tr-2xl border-r-2 border-t-2")}
      />
      <span
        className={cn(CORNER, tone, "bottom-0 left-0 rounded-bl-2xl border-b-2 border-l-2")}
      />
      <span
        className={cn(CORNER, tone, "bottom-0 right-0 rounded-br-2xl border-b-2 border-r-2")}
      />
    </div>
  );
}
