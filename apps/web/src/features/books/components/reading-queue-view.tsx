"use client";

import type { QueuePriority } from "@app/shared";

import { QueuePrioritySchema } from "@app/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link, useRouter } from "@/i18n/navigation";
import { queuePriorities, type StatusEntry } from "@/lib/book-status";

import type { LibraryBookLabels } from "../model/library-book";

import { useReadingQueue } from "../api/use-reading-queue";
import { toLibraryBook } from "../model/library-book";
import { BookRow } from "./book-row";
import { RemoveFromQueueDialog } from "./remove-from-queue-dialog";

const SKELETON_COUNT = 6;

const PRIORITY_ENTRIES: readonly StatusEntry[] = queuePriorities;
const DEFAULT_PRIORITY_ENTRY: StatusEntry =
  PRIORITY_ENTRIES.find((entry) => entry.isDefault) ?? queuePriorities[1];
const DEFAULT_PRIORITY: QueuePriority = QueuePrioritySchema.parse(DEFAULT_PRIORITY_ENTRY.value);

export function ReadingQueueView() {
  const t = useTranslations("readingQueue");
  const tLibrary = useTranslations("books.library");
  const tStatus = useTranslations("books.readingStatus.options");
  const tOwnership = useTranslations("books.ownershipStatus.options");
  const tPriority = useTranslations("books.organization.priorityLabels");
  const router = useRouter();
  const { data, isError, isPending, refetch } = useReadingQueue();
  const [removeTargetId, setRemoveTargetId] = useState<null | string>(null);

  const labels: LibraryBookLabels = {
    borrowedFrom: (name) => tLibrary("card.borrowedFrom", { name }),
    genreName: (key) => key,
    lentTo: (name) => tLibrary("card.lentTo", { name }),
    ownershipLabel: (value) => tOwnership(value),
    pagesText: (value) => tLibrary("meta.pages", { value }),
    progressAriaLabel: (current, total) => tLibrary("progress.ariaLabel", { current, total }),
    progressUnit: tLibrary("progress.unit"),
    ratingLabel: (value) => tLibrary("rating.ariaLabel", { value }),
    statusLabel: (value) => tStatus(value),
  };

  const errorState: EmptyStateEntry = {
    desc: tLibrary("error.description"),
    illu: "error-generic",
    primary: { icon: "refresh", label: tLibrary("error.retry") },
    title: tLibrary("error.title"),
  };

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
        <h1 className="font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-semibold text-ink">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {isError ? (
        <div aria-live="assertive" role="alert">
          <EmptyState onPrimary={() => void refetch()} state={errorState} />
        </div>
      ) : isPending ? (
        <QueueSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          onPrimary={() => router.push("/books/new")}
          onSecondary={() => router.push("/books")}
          stateKey="queue"
        />
      ) : (
        <ol className="flex flex-col gap-2.5">
          {items.map((item) => {
            const priority = item.book.queuePriority ?? DEFAULT_PRIORITY;
            const priorityEntry = resolvePriorityEntry(priority);
            return (
              <li className="flex items-start gap-3" key={item.book.id}>
                <span className="mt-3.5 w-8 shrink-0 text-right font-mono text-sm text-muted-foreground tabular-nums">
                  #{item.position}
                </span>
                <div className="min-w-0 flex-1">
                  <BookRow
                    book={toLibraryBook(item.book, labels)}
                    kebab={
                      <div className="flex items-center gap-2">
                        <StatusBadge entry={{ ...priorityEntry, label: tPriority(priority) }} />
                        <Button
                          aria-label={t("removeAria", { title: item.book.title })}
                          onClick={() => setRemoveTargetId(item.book.id)}
                          size="icon"
                          variant="ghost"
                        >
                          <UiIcon name="x-circle" size={16} />
                        </Button>
                      </div>
                    }
                    linkComponent={Link}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {removeTargetId === null ? null : (
        <RemoveFromQueueDialog
          book={{ id: removeTargetId }}
          onOpenChange={(open) => {
            if (!open) setRemoveTargetId(null);
          }}
          open
        />
      )}
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-2.5">
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div className="flex items-start gap-3" key={index}>
          <Skeleton className="mt-3.5 h-4 w-8 shrink-0" />
          <Skeleton className="h-20 flex-1 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

function resolvePriorityEntry(priority: QueuePriority): StatusEntry {
  return PRIORITY_ENTRIES.find((entry) => entry.value === priority) ?? DEFAULT_PRIORITY_ENTRY;
}
