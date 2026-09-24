/**
 * Mode inferensi. Nilainya HARUS sama dengan yang diterima backend:
 * "model_1" | "model_2" | "both"
 */
export type DetectionMode = "model_1" | "model_2" | "both";

export interface DetectionResult {
  active_mode?: DetectionMode;
  image: string;
  model_1_count: number;
  model_2_count: number;
}

/**
 * Konfirmasi dari backend setelah mode diubah:
 * { status: "mode_changed", current_mode: "..." }
 */
export interface ModeChangedMessage {
  status: "mode_changed";
  current_mode: DetectionMode;
}

export type ServerMessage = DetectionResult | ModeChangedMessage;

export function isModeChangedMessage(
  message: ServerMessage,
): message is ModeChangedMessage {
  return "status" in message && message.status === "mode_changed";
}

export interface Counts {
  model1: number;
  model2: number;
}

export interface PerfStats {
  fps: number;
  latencyMs: number;
}

export const MODE_LABELS: Record<DetectionMode, string> = {
  model_1: "Model 1",
  model_2: "Model 2",
  both: "Both",
};

export const MODE_SUMMARY: Record<DetectionMode, string> = {
  model_1: "Model 1 only",
  model_2: "Model 2 only",
  both: "Model 1 + Model 2",
};

export const MODE_DESCRIPTIONS: Record<DetectionMode, string> = {
  model_1: "Hanya Model 1 yang berjalan. Kotak hijau.",
  model_2: "Hanya Model 2 yang berjalan. Kotak merah.",
  both: "Kedua model berjalan bersamaan. Lebih berat di CPU, frame rate bisa turun.",
};
