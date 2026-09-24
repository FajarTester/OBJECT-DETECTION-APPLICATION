import { cva } from "class-variance-authority";

/**
 * Style untuk item segmented control. Dipakai oleh ToggleGroupItem.
 * Class "group" dipakai supaya ikon di dalamnya bisa berubah warna
 * saat item aktif (group-data-[state=on]).
 */
export const toggleVariants = cva(
  "group inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl font-medium text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-white data-[state=on]:text-slate-950 data-[state=on]:shadow-lg",
  {
    variants: {
      size: {
        default: "h-11 px-3 text-xs",
        sm: "h-10 px-2 text-[11px]",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);
