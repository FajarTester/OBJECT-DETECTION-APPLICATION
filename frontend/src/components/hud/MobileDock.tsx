import type { ReactNode } from "react";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import { ChevronUp, X } from "lucide-react";

import { cn } from "../../lib/utils";
import type { Counts, DetectionMode } from "../../types";
import { Button } from "../ui/button";
import { ModeSelector } from "./ModeSelector";

interface MobileDockProps {
  counts: Counts;
  mode: DetectionMode;
  onModeChange: (mode: DetectionMode) => void;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** Isi drawer detail (status sistem, tombol aksi). */
  children: ReactNode;
}

const IS_IOS =
  typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

function Stat({
  label,
  value,
  active = true,
  valueClass,
  dot,
}: {
  label: string;
  value: number | string;
  active?: boolean;
  valueClass?: string;
  dot?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 transition-opacity",
        !active && "opacity-45",
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] text-white/50">
        {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />}

        {label}
      </div>

      <p
        className={cn(
          "mt-0.5 text-2xl font-semibold leading-tight tabular-nums",
          !active && "text-base text-white/50",
          active && valueClass,
        )}
      >
        {active ? value : "Off"}
      </p>
    </div>
  );
}

export function MobileDock({
  counts,
  mode,
  onModeChange,
  open,
  onOpen,
  onClose,
  children,
}: MobileDockProps) {
  const model1Active = mode !== "model_2";
  const model2Active = mode !== "model_1";

  const total =
    (model1Active ? counts.model1 : 0) + (model2Active ? counts.model2 : 0);

  return (
    <>
      <section className="absolute inset-x-0 bottom-0 z-20 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-3 shadow-2xl backdrop-blur-xl">
          <button
            type="button"
            onClick={onOpen}
            aria-label="Open details"
            className="mx-auto mb-2 flex h-6 w-16 items-center justify-center rounded-full text-white/40 transition hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ChevronUp className="h-5 w-5" />
          </button>

          <div className="grid grid-cols-3 gap-2">
            <Stat label="Total" value={total} />

            <Stat
              label="Model 1"
              value={counts.model1}
              active={model1Active}
              valueClass="text-emerald-400"
              dot="bg-emerald-400"
            />

            <Stat
              label="Model 2"
              value={counts.model2}
              active={model2Active}
              valueClass="text-red-400"
              dot="bg-red-400"
            />
          </div>

          <div className="mt-2">
            <ModeSelector mode={mode} onChange={onModeChange} size="sm" />
          </div>
        </div>
      </section>

      <SwipeableDrawer
        anchor="bottom"
        open={open}
        onOpen={onOpen}
        onClose={onClose}
        disableSwipeToOpen
        disableBackdropTransition={!IS_IOS}
        disableDiscovery={IS_IOS}
        slotProps={{
          paper: {
            sx: {
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              backgroundImage: "none",
              backgroundColor: "rgba(2, 6, 23, 0.94)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderBottom: 0,
            },
          },
        }}
      >
        <div className="mx-auto w-full max-w-lg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Details</h2>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close details"
            >
              <X />
            </Button>
          </div>

          {children}
        </div>
      </SwipeableDrawer>
    </>
  );
}
