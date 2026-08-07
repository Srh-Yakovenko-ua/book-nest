import type { UiIconName } from "@/components/icons";

export type StatusDefinition = {
  icon: UiIconName;
  isDefault?: boolean;
  tone: StatusTone;
  value: string;
};

export type StatusEntry = StatusDefinition & { label: string };

export type StatusTone =
  "accent" | "danger" | "info" | "neutral" | "primary" | "success" | "warning";

export const readingStatuses = [
  { icon: "circle-slash", isDefault: true, tone: "neutral", value: "not_started" },
  { icon: "bookmark", tone: "accent", value: "want_to_read" },
  { icon: "book", tone: "info", value: "reading" },
  { icon: "clock", tone: "warning", value: "paused" },
  { icon: "check-circle", tone: "success", value: "finished" },
  { icon: "x-circle", tone: "neutral", value: "dnf" },
  { icon: "refresh", tone: "info", value: "rereading" },
] as const satisfies readonly StatusDefinition[];

export const ownershipStatuses = [
  { icon: "circle-slash", isDefault: true, tone: "neutral", value: "none" },
  { icon: "cart", tone: "accent", value: "want_to_buy" },
  { icon: "truck", tone: "info", value: "in_transit" },
  { icon: "check-circle", tone: "success", value: "owned" },
  { icon: "arrow-down-circle", tone: "info", value: "borrowed_from_someone" },
  { icon: "arrow-up-right", tone: "neutral", value: "lent_to_someone" },
] as const satisfies readonly StatusDefinition[];

export const bookFormats = [
  { icon: "book", tone: "neutral", value: "paper" },
  { icon: "tablet", tone: "neutral", value: "ebook" },
  { icon: "headphones", tone: "neutral", value: "audiobook" },
] as const satisfies readonly StatusDefinition[];

export const seriesStatuses = [
  { icon: "check-circle", tone: "success", value: "completed" },
  { icon: "clock", tone: "info", value: "ongoing" },
  { icon: "help-circle", isDefault: true, tone: "neutral", value: "unknown" },
] as const satisfies readonly StatusDefinition[];

export const deliveryStatuses = [
  { icon: "package", isDefault: true, tone: "neutral", value: "ordered" },
  { icon: "truck", tone: "info", value: "in_transit" },
  { icon: "store", tone: "accent", value: "ready_for_pickup" },
  { icon: "check-circle", tone: "success", value: "received" },
  { icon: "x-circle", tone: "neutral", value: "cancelled" },
] as const satisfies readonly StatusDefinition[];

export const loanDueStatuses = [
  { icon: "clock", isDefault: true, tone: "neutral", value: "active" },
  { icon: "bell", tone: "warning", value: "due_soon" },
  { icon: "alert-triangle", tone: "danger", value: "overdue" },
  { icon: "circle-slash", tone: "neutral", value: "no_due_date" },
  { icon: "check-circle", tone: "success", value: "returned" },
] as const satisfies readonly StatusDefinition[];

export const queuePriorities = [
  { icon: "arrow-up", tone: "accent", value: "high" },
  { icon: "minus", isDefault: true, tone: "neutral", value: "normal" },
  { icon: "arrow-down", tone: "neutral", value: "low" },
] as const satisfies readonly StatusDefinition[];

export const contentFlags = [
  { icon: "eye-off", tone: "warning", value: "spoiler" },
] as const satisfies readonly StatusDefinition[];
