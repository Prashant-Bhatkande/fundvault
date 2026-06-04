import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "success" | "warning" | "destructive";
  className?: string;
}

const toneRing: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-primary bg-primary/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/15",
  destructive: "text-destructive bg-destructive/10",
};

export function StatCard({ label, value, icon, hint, tone = "default", className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-5 shadow-card flex flex-col gap-3",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {icon && (
          <span className={cn("h-8 w-8 rounded-lg flex items-center justify-center", toneRing[tone])}>
            {icon}
          </span>
        )}
      </div>
      <div className="font-display text-2xl md:text-3xl font-bold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
