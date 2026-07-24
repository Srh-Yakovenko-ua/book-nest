"use client";

import type { Nullable, TimelineEventPreview } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { EventSearchSelect } from "./event-search-select";

type ResolvedByFieldProps = {
  bookId: string;
  initialPreview: Nullable<TimelineEventPreview>;
  onChange: (eventId: Nullable<string>) => void;
  selfEventId: Nullable<string>;
  value: Nullable<string>;
};

type ResolvedBySelection = {
  id: string;
  title: string;
};

export function ResolvedByField({
  bookId,
  initialPreview,
  onChange,
  selfEventId,
  value,
}: ResolvedByFieldProps) {
  const t = useTranslations("timeline.form");
  const [selection, setSelection] = useState<Nullable<ResolvedBySelection>>(null);

  const excludeIds = selfEventId === null ? [] : [selfEventId];
  const displayTitle =
    selection?.title ?? (initialPreview?.id === value ? initialPreview.title : null);

  if (value !== null) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <span className="inline-flex min-w-0 items-center gap-2 text-sm text-foreground">
          <UiIcon className="shrink-0 text-success" name="check-circle" size={15} />
          <span className={cn("truncate", displayTitle === null && "text-muted-foreground")}>
            {displayTitle ?? t("resolvedByLoading")}
          </span>
        </span>
        <Button
          onClick={() => {
            setSelection(null);
            onChange(null);
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          {t("resolvedByClear")}
        </Button>
      </div>
    );
  }

  return (
    <EventSearchSelect
      bookId={bookId}
      excludeIds={excludeIds}
      onSelect={(event) => {
        setSelection({ id: event.id, title: event.title });
        onChange(event.id);
      }}
      placeholder={t("resolvedBySearchPlaceholder")}
    />
  );
}
