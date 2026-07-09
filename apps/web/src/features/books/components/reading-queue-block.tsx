"use client";

import type { BookView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { queuePriorities } from "@/lib/book-status";

import { useReadingQueuePosition } from "../api/use-reading-queue";
import { ChangeQueuePriorityDialog } from "./change-queue-priority-dialog";
import { RemoveFromQueueDialog } from "./remove-from-queue-dialog";

type ReadingQueueBlockProps = {
  book: BookView;
};

export function ReadingQueueBlock({ book }: ReadingQueueBlockProps) {
  const t = useTranslations("books.details.queue");
  const tPriority = useTranslations("books.organization.priorityLabels");
  const position = useReadingQueuePosition(book);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  if (!book.isInReadingQueue) return null;

  const priorityEntry =
    book.queuePriority === null
      ? undefined
      : queuePriorities.find((entry) => entry.value === book.queuePriority);

  return (
    <>
      <Card className="shadow-detail-block">
        <CardHeader>
          <CardTitle asChild>
            <h2>{t("title")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <dl className="flex flex-col gap-3">
            <QueueRow label={t("rowStatus")}>
              <StatusBadge
                entry={{ icon: "list", label: t("inQueue"), tone: "info", value: "in_queue" }}
              />
            </QueueRow>
            {position === null ? null : (
              <QueueRow label={t("rowPosition")}>
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {t("positionValue", { position })}
                </span>
              </QueueRow>
            )}
            {priorityEntry === undefined || book.queuePriority === null ? null : (
              <QueueRow label={t("rowPriority")}>
                <StatusBadge entry={{ ...priorityEntry, label: tPriority(book.queuePriority) }} />
              </QueueRow>
            )}
          </dl>

          <div className="flex flex-col gap-2">
            <Button asChild variant="secondary">
              <Link href="/reading-queue">
                <UiIcon name="list" size={16} />
                {t("goToQueue")}
              </Link>
            </Button>
            <Button onClick={() => setPriorityOpen(true)} variant="secondary">
              <UiIcon name="sliders" size={16} />
              {t("changePriority")}
            </Button>
            <Button onClick={() => setRemoveOpen(true)} variant="ghost">
              <UiIcon name="x-circle" size={16} />
              {t("remove")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ChangeQueuePriorityDialog book={book} onOpenChange={setPriorityOpen} open={priorityOpen} />
      <RemoveFromQueueDialog book={book} onOpenChange={setRemoveOpen} open={removeOpen} />
    </>
  );
}

function QueueRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-wrap justify-end">{children}</dd>
    </div>
  );
}
