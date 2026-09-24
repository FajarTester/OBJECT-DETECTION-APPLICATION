import { Layers, ScanLine } from "lucide-react";

import { MODE_LABELS, type DetectionMode } from "../../types";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";

interface ModeSelectorProps {
  mode: DetectionMode;
  onChange: (mode: DetectionMode) => void;
  size?: "default" | "sm";
}

const ICON_CLASS: Record<DetectionMode, string> = {
  model_1: "text-emerald-400 group-data-[state=on]:text-emerald-600",
  model_2: "text-red-400 group-data-[state=on]:text-red-600",
  both: "text-white/70 group-data-[state=on]:text-slate-950",
};

const MODES: DetectionMode[] = ["model_1", "model_2", "both"];

export function ModeSelector({
  mode,
  onChange,
  size = "default",
}: ModeSelectorProps) {
  return (
    <ToggleGroup
      type="single"
      value={mode}
      size={size}
      aria-label="Detection mode"
      // Radix mengirim "" saat item aktif diklik lagi, abaikan.
      onValueChange={(value) => {
        if (value) {
          onChange(value as DetectionMode);
        }
      }}
      className="grid w-full grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-white/5 p-1"
    >
      {MODES.map((value) => {
        const Icon = value === "both" ? Layers : ScanLine;

        return (
          <ToggleGroupItem
            key={value}
            value={value}
            aria-label={MODE_LABELS[value]}
          >
            <Icon className={`h-4 w-4 ${ICON_CLASS[value]}`} />

            {MODE_LABELS[value]}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
