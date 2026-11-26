"use client";

import type { Nullable } from "@app/shared";
import type { MutationStatus } from "@tanstack/react-query";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { UiIcon } from "@/components/icons";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { HTTP_STATUS, isApiErrorStatus } from "@/lib/api-errors";
import { cn } from "@/lib/utils";

import { useTestNotification } from "../api/use-test-notification";

type TestNotificationResult = "error" | "rateLimited" | "success";

const TEST_RESULT_TONE = {
  error: "text-error",
  rateLimited: "text-error",
  success: "text-success",
} as const satisfies Record<TestNotificationResult, string>;

export function TestNotificationBlock() {
  const t = useTranslations("settings.notifications.test");
  const generatedId = useId();
  const testNotification = useTestNotification();

  const descriptionId = `settings-test-notification-description-${generatedId}`;
  const result = testNotificationResult(testNotification);

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-xs leading-relaxed text-muted-foreground" id={descriptionId}>
        {t("description")}
      </p>
      <Button
        aria-busy={testNotification.isPending || undefined}
        aria-describedby={descriptionId}
        aria-disabled={testNotification.isPending || undefined}
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        onClick={() => {
          if (testNotification.isPending) return;
          testNotification.mutate();
        }}
        size="sm"
        variant="secondary"
      >
        {testNotification.isPending ? <Spinner size="sm" /> : <UiIcon name="bell" size={14} />}
        {t("button")}
      </Button>
      <p
        aria-live="polite"
        className={cn(
          "text-xs leading-relaxed",
          result === null ? "sr-only" : TEST_RESULT_TONE[result],
        )}
        role="status"
      >
        {result === null ? "" : t(result)}
      </p>
    </div>
  );
}

function testNotificationResult({
  error,
  status,
}: {
  error: unknown;
  status: MutationStatus;
}): Nullable<TestNotificationResult> {
  if (status === "success") return "success";
  if (status !== "error") return null;
  return isApiErrorStatus(error, HTTP_STATUS.tooManyRequests) ? "rateLimited" : "error";
}
