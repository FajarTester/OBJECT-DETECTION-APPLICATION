import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

export function StatusPill({
  isConnected,
  className,
}: {
  isConnected: boolean;
  className?: string;
}) {
  return (
    <Badge
      variant={isConnected ? "success" : "danger"}
      className={cn("gap-1.5", className)}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isConnected
            ? "animate-pulse bg-emerald-400 motion-reduce:animate-none"
            : "bg-red-400",
        )}
      />

      {isConnected ? "Live" : "Offline"}
    </Badge>
  );
}
