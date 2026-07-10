import type { UiIconName } from "@/components/icons";

export type StatusEntry = {
  icon: UiIconName;
  isDefault?: boolean;
  label: string;
  lentLabel?: string;
  tone: StatusTone;
  value: string;
};

export type StatusTone =
  | "accent"
  | "danger"
  | "info"
  | "neutral"
  | "primary"
  | "success"
  | "warning";

export const readingStatuses = [
  {
    icon: "circle-slash",
    isDefault: true,
    label: "Не почато",
    tone: "neutral",
    value: "not_started",
  },
  { icon: "bookmark", label: "Хочу прочитати", tone: "accent", value: "want_to_read" },
  { icon: "book", label: "Читаю", tone: "info", value: "reading" },
  { icon: "clock", label: "На паузі", tone: "warning", value: "paused" },
  { icon: "check-circle", label: "Прочитано", tone: "success", value: "finished" },
  { icon: "x-circle", label: "Покинуто", tone: "neutral", value: "dnf" },
  { icon: "refresh", label: "Перечитую", tone: "info", value: "rereading" },
] as const satisfies readonly StatusEntry[];

export const ownershipStatuses = [
  { icon: "circle-slash", isDefault: true, label: "Немає", tone: "neutral", value: "none" },
  { icon: "cart", label: "Хочу купити", tone: "accent", value: "want_to_buy" },
  { icon: "truck", label: "В дорозі", tone: "info", value: "in_transit" },
  { icon: "check-circle", label: "Маю", tone: "success", value: "owned" },
  {
    icon: "arrow-down-circle",
    label: "Позичена у когось",
    tone: "info",
    value: "borrowed_from_someone",
  },
  { icon: "arrow-up-right", label: "Видана комусь", tone: "neutral", value: "lent_to_someone" },
] as const satisfies readonly StatusEntry[];

export const bookFormats = [
  { icon: "book", label: "Паперова", tone: "neutral", value: "paper" },
  { icon: "tablet", label: "Електронна", tone: "neutral", value: "ebook" },
  { icon: "headphones", label: "Аудіокнига", tone: "neutral", value: "audiobook" },
] as const satisfies readonly StatusEntry[];

export const seriesStatuses = [
  { icon: "check-circle", label: "Серія завершена", tone: "success", value: "completed" },
  { icon: "clock", label: "Серія ще виходить", tone: "info", value: "ongoing" },
  { icon: "help-circle", isDefault: true, label: "Невідомо", tone: "neutral", value: "unknown" },
] as const satisfies readonly StatusEntry[];

export const deliveryStatuses = [
  { icon: "package", isDefault: true, label: "Замовлена", tone: "neutral", value: "ordered" },
  { icon: "truck", label: "В дорозі", tone: "info", value: "in_transit" },
  { icon: "store", label: "Готова до отримання", tone: "accent", value: "ready_for_pickup" },
  { icon: "check-circle", label: "Отримана", tone: "success", value: "received" },
  { icon: "x-circle", label: "Скасована", tone: "neutral", value: "cancelled" },
] as const satisfies readonly StatusEntry[];

export const loanDueStatuses = [
  { icon: "clock", isDefault: true, label: "Активна", tone: "neutral", value: "active" },
  {
    icon: "bell",
    label: "Скоро повернути",
    lentLabel: "Скоро мають повернути",
    tone: "warning",
    value: "due_soon",
  },
  { icon: "alert-triangle", label: "Прострочено", tone: "danger", value: "overdue" },
  { icon: "circle-slash", label: "Без дати повернення", tone: "neutral", value: "no_due_date" },
  {
    icon: "check-circle",
    label: "Повернуто",
    lentLabel: "Повернуто мені",
    tone: "success",
    value: "returned",
  },
] as const satisfies readonly StatusEntry[];

export const queuePriorities = [
  { icon: "arrow-up", label: "Високий", tone: "accent", value: "high" },
  { icon: "minus", isDefault: true, label: "Звичайний", tone: "neutral", value: "normal" },
  { icon: "arrow-down", label: "Низький", tone: "neutral", value: "low" },
] as const satisfies readonly StatusEntry[];

export const contentFlags = [
  { icon: "eye-off", label: "Спойлер", tone: "warning", value: "spoiler" },
] as const satisfies readonly StatusEntry[];
