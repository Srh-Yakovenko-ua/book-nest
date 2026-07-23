"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";

import { useReadingQueuePosition } from "../api/use-reading-queue";
import { useRemoveFromQueueWithUndo } from "../model/use-remove-from-queue-with-undo";
import { AddToQueueDialog } from "./add-to-queue-dialog";

type ReadingQueueBlockProps = {
  book: BookView;
};

export function ReadingQueueBlock({ book }: ReadingQueueBlockProps) {
  const t = useTranslations("books.details.queue");
  const position = useReadingQueuePosition(book);
  const removeFromQueue = useRemoveFromQueueWithUndo();
  const [addOpen, setAddOpen] = useState(false);

  const addButtonRef = useRef<HTMLButtonElement>(null);
  const wasInQueue = useRef(book.isInReadingQueue);
  useEffect(() => {
    const leftQueue = wasInQueue.current && !book.isInReadingQueue;
    wasInQueue.current = book.isInReadingQueue;
    const focusLeftToBody =
      document.activeElement === null || document.activeElement === document.body;
    if (!leftQueue || !focusLeftToBody) return;
    addButtonRef.current?.focus({ preventScroll: true });
  }, [book.isInReadingQueue]);

  return (
    <>
      <Card className="gap-4 shadow-detail-block">
        <CardHeader>
          <CardTitle asChild>
            <h2>{t("title")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {book.isInReadingQueue ? (
            <>
              <StatusBadge
                entry={{
                  icon: "list",
                  label: position === null ? t("inQueue") : t("inQueuePosition", { position }),
                  tone: "info",
                  value: "in_queue",
                }}
              />
              <div className="flex flex-col gap-2">
                <Button asChild variant="secondary">
                  <Link href="/reading-queue">
                    <UiIcon name="list" size={16} />
                    {t("goToQueue")}
                  </Link>
                </Button>
                <Button
                  disabled={removeFromQueue.isPending}
                  onClick={() => removeFromQueue.remove(book.id, position)}
                  variant="ghost"
                >
                  <UiIcon name="x-circle" size={16} />
                  {t("remove")}
                </Button>
              </div>
            </>
          ) : (
            <Button onClick={() => setAddOpen(true)} ref={addButtonRef} variant="secondary">
              <UiIcon name="bookmark" size={16} />
              {t("add")}
            </Button>
          )}
        </CardContent>
      </Card>

      <AddToQueueDialog book={book} context="detail" onOpenChange={setAddOpen} open={addOpen} />
    </>
  );
}
