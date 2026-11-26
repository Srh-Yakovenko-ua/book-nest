"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { AutosaveStatus } from "../hooks/use-autosave-field";

type FieldSaveStatusProps = {
  className?: string;
  fieldLabelId?: string;
  onRetry: () => void;
  status: AutosaveStatus;
};

const SAVE_STATUS_MESSAGE = {
  error: "error",
  idle: null,
  saved: "saved",
  saving: "saving",
} as const satisfies Record<AutosaveStatus, "error" | "saved" | "saving" | null>;

export function FieldSaveStatus({
  className,
  fieldLabelId,
  onRetry,
  status,
}: FieldSaveStatusProps) {
  const t = useTranslations("settings.saveStatus");
  const messageKey = SAVE_STATUS_MESSAGE[status];
  const isError = status === "error";
  const isShown = isError || status === "saving";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1",
        !isShown && "sr-only",
        className,
      )}
    >
      <p
        aria-live="polite"
        className={cn("text-xs leading-relaxed", isError ? "text-error" : "text-muted-foreground")}
        role="status"
      >
        {messageKey === null ? "" : t(messageKey)}
      </p>
      {isError ? (
        <Button aria-describedby={fieldLabelId} onClick={onRetry} size="xs" variant="secondary">
          <UiIcon name="refresh" size={12} />
          {t("retry")}
        </Button>
      ) : null}
    </div>
  );
}
