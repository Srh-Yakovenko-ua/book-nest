"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";

type UnlinkFactsImpactState =
  { count: number; kind: "counted" } | { kind: "counting" } | { kind: "unknown" };

export function toUnlinkFactsImpact({
  data,
  isError,
}: {
  data: number | undefined;
  isError: boolean;
}): UnlinkFactsImpactState {
  if (isError) return { kind: "unknown" };
  if (data === undefined) return { kind: "counting" };
  return { count: data, kind: "counted" };
}

export function UnlinkFactsImpact({ impact }: { impact: UnlinkFactsImpactState }) {
  return (
    <div aria-live="polite">
      <FactsImpactLine impact={impact} />
    </div>
  );
}

function FactsImpactLine({ impact }: { impact: UnlinkFactsImpactState }) {
  const t = useTranslations("characters.unlink");

  if (impact.kind === "unknown") {
    return (
      <p className="rounded-lg bg-secondary/50 px-3 py-2.5 text-sm text-foreground">
        {t("factsUnavailable")}
      </p>
    );
  }

  if (impact.kind === "counting") {
    return (
      <div aria-busy className="rounded-lg bg-secondary/50 px-3 py-2.5" role="status">
        <span className="sr-only">{t("factsLoading")}</span>
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  if (impact.count === 0) return null;

  return (
    <p className="flex items-start gap-2 rounded-lg bg-error-soft px-3 py-2.5 text-sm text-foreground">
      <UiIcon className="mt-0.5 shrink-0 text-error" name="alert-triangle" size={16} />
      <span>{t("factsWarning", { count: impact.count })}</span>
    </p>
  );
}
