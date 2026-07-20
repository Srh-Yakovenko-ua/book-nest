import { cva } from "class-variance-authority";

export const priorityCardVariants = cva(
  "relative flex min-h-24 cursor-pointer items-center gap-3 rounded-xl border bg-card p-4 text-left transition hover:shadow-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
  {
    compoundVariants: [
      { active: true, className: "border-success/60 bg-success-soft/40", tone: "low" },
      { active: true, className: "border-warning/60 bg-warning-soft/40", tone: "normal" },
      { active: true, className: "border-primary bg-primary/5", tone: "high" },
    ],
    defaultVariants: { active: false },
    variants: {
      active: {
        false: "border-border hover:border-accent-border",
        true: "",
      },
      tone: { high: "", low: "", normal: "" },
    },
  },
);

export const priorityChipVariants = cva(
  "inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
  {
    variants: {
      tone: {
        high: "border-primary/30 bg-primary/10 text-primary",
        low: "border-success/40 bg-success-soft/60 text-success",
        normal: "border-warning/40 bg-warning-soft/60 text-warning",
      },
    },
  },
);

export const priorityIconBadgeVariants = cva(
  "flex shrink-0 items-center justify-center rounded-md",
  {
    defaultVariants: { size: "md" },
    variants: {
      size: {
        lg: "size-11",
        md: "size-9",
      },
      tone: {
        high: "bg-primary/15 text-primary",
        low: "bg-success-soft text-success",
        normal: "bg-warning-soft text-warning",
      },
    },
  },
);

export const priorityMarkerVariants = cva("shrink-0", {
  compoundVariants: [
    { active: true, className: "text-success", tone: "low" },
    { active: true, className: "text-warning", tone: "normal" },
    { active: true, className: "text-primary", tone: "high" },
  ],
  variants: {
    active: {
      false: "text-muted-foreground/70",
      true: "",
    },
    tone: { high: "", low: "", normal: "" },
  },
});
