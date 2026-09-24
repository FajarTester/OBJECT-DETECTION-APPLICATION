import { ScanEye } from "lucide-react";

export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-950 shadow-lg">
        <ScanEye className="h-5 w-5" strokeWidth={2} />
      </div>

      <div className="leading-tight">
        <h1 className="text-sm font-semibold tracking-tight">
          Vision Detection
        </h1>

        <p className="text-[11px] text-white/45">Object monitoring</p>
      </div>
    </div>
  );
}
