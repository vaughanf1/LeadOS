import { cn } from "@/lib/utils";

type Variant = "neutral" | "brand" | "success" | "warning" | "danger";

const STYLES: Record<Variant, string> = {
  neutral: "bg-canvas-subtle text-ink-muted border-line",
  brand: "bg-brand/10 text-brand border-brand/20",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-danger/10 text-danger border-danger/20",
};

export function StatusPill({
  children,
  variant = "neutral",
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STYLES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function leadStatusVariant(status: string): Variant {
  switch (status) {
    case "SENT":
    case "ASSIGNED":
      return "success";
    case "HELD":
    case "AFTER_HOURS":
      return "warning";
    case "FAILED":
    case "DUPLICATE":
      return "danger";
    case "NEW":
      return "brand";
    default:
      return "neutral";
  }
}

export function qualityVariant(band: string | null | undefined): Variant {
  if (band === "HIGH") return "success";
  if (band === "MID") return "brand";
  if (band === "LOW") return "warning";
  return "neutral";
}

export function advisorStatusVariant(s: string): Variant {
  if (s === "ACTIVE") return "success";
  if (s === "PAUSED" || s === "HOLIDAY") return "warning";
  if (s === "FULL") return "danger";
  return "neutral";
}
