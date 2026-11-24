"use client";

import type { HomeNextReadCandidate, Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StartReadingDialog, useChangeReadingStatus } from "@/features/books";
import { Link } from "@/i18n/navigation";
import { assertNever } from "@/lib/assert-never";
import { formatDateShort } from "@/lib/format";

import type { HomeNextReadState } from "../model/home-next-read";

import { HOME_CONTEXT_LINKS } from "../model/home-context-links";
import { HOME_LIBRARY_LINKS, homeBookHref } from "../model/home-library-links";
import {
  followingNextReadId,
  nextReadActionLabel,
  nextReadFlow,
  selectNextReadCandidate,
} from "../model/home-next-read";
import { HomeBookCover } from "./home-book-cover";
import { HomeCard } from "./home-card";
import { HomeSectionError } from "./home-section-error";

type HomeNextReadProps = {
  isRetrying: boolean;
  onRetry: () => void;
  state: HomeNextReadState;
};

type StartTarget = { id: string; title: string };

const NEXT_READ_ILLUSTRATION = {
  height: 135,
  src: "/illustrations/home/home-next-read-branch.png",
  width: 180,
} as const;

const NEXT_READ_ACTION_ICON = {
  continueSeries: "layers",
  resume: "bookmark",
  start: "book-open-text",
} as const;

export function HomeNextRead({ isRetrying, onRetry, state }: HomeNextReadProps) {
  const t = useTranslations("home.nextRead");

  return (
    <HomeCard className="relative h-full" icon="bookmark" title={t("title")}>
      <NextReadBody isRetrying={isRetrying} onRetry={onRetry} state={state} />
    </HomeCard>
  );
}

function CandidateDetails({ candidate }: { candidate: HomeNextReadCandidate }) {
  const t = useTranslations("home.nextRead");
  const tOwnership = useTranslations("books.ownershipStatus.options");
  const locale = useLocale();
  const { book, queue, series } = candidate;
  const authors = book.authors.map((author) => author.name).join(", ");

  return (
    <div aria-live="polite" className="flex min-w-0 flex-1 flex-col gap-1">
      <h3 className="text-base leading-snug font-semibold">
        <Link
          className="line-clamp-2 cursor-pointer rounded-sm wrap-anywhere text-ink outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
          href={homeBookHref(book.id)}
        >
          {book.title}
        </Link>
      </h3>
      {authors.length === 0 ? null : (
        <p className="line-clamp-1 text-sm wrap-anywhere text-muted-foreground">{authors}</p>
      )}
      <p className="text-xs text-muted-foreground">
        {[
          tOwnership(book.ownershipStatus),
          book.pagesCount === null ? null : t("pages", { count: book.pagesCount }),
        ]
          .filter((part) => part !== null)
          .join(" · ")}
      </p>
      <p className="flex items-start gap-1.5 text-xs text-foreground">
        <UiIcon aria-hidden className="mt-px shrink-0 text-primary" name="sparkles" size={14} />
        <span className="min-w-0 wrap-anywhere">{t(`reason.${candidate.reason}`)}</span>
      </p>
      {queue === null ? null : (
        <p className="text-xs text-muted-foreground">
          {queue.targetDate === null
            ? t("queuePosition", { position: queue.position })
            : t("queuePositionWithDate", {
                date: formatDateShort(queue.targetDate, locale),
                position: queue.position,
              })}
        </p>
      )}
      {series === null ? null : (
        <p className="line-clamp-1 text-xs wrap-anywhere text-muted-foreground">
          {series.partNumber === null
            ? series.name
            : t("seriesPart", { name: series.name, part: series.partNumber })}
        </p>
      )}
      {candidate.action === "resume" && book.progressPercent !== null ? (
        <p className="text-xs text-muted-foreground tabular-nums">
          {t("resumeProgress", { percent: Math.round(book.progressPercent) })}
        </p>
      ) : null}
    </div>
  );
}

function EmptyLink({ children, href }: { children: string; href: string }) {
  return (
    <Link
      className="inline-flex cursor-pointer items-center gap-1 rounded-md text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      href={href}
    >
      {children}
      <UiIcon aria-hidden name="arrow-right" size={14} />
    </Link>
  );
}

function NextReadBody({ isRetrying, onRetry, state }: HomeNextReadProps) {
  const t = useTranslations("home.nextRead");
  const tCommon = useTranslations("common");

  switch (state.kind) {
    case "candidates":
      return <NextReadCandidates candidates={state.candidates} isIncomplete={state.isIncomplete} />;
    case "empty":
      return (
        <div className="flex flex-1 flex-col items-start justify-center gap-2">
          <p className="text-sm text-foreground">{t("empty.description")}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <EmptyLink href={HOME_CONTEXT_LINKS.readingQueue}>{t("empty.toQueue")}</EmptyLink>
            <EmptyLink href={HOME_LIBRARY_LINKS.counts.total}>{t("empty.toCatalogue")}</EmptyLink>
          </div>
        </div>
      );
    case "error":
      return (
        <HomeSectionError
          isRetrying={isRetrying}
          onRetry={onRetry}
          retryLabel={t("error.retry")}
          title={t("error.title")}
        />
      );
    case "incomplete":
      return (
        <HomeSectionError
          isRetrying={isRetrying}
          onRetry={onRetry}
          retryLabel={t("error.retry")}
          title={t("incomplete.empty")}
        />
      );
    case "loading":
      return (
        <div aria-busy className="flex gap-3">
          <span className="sr-only" role="status">
            {tCommon("loading")}
          </span>
          <Skeleton className="aspect-2/3 w-16 shrink-0 @2xl/home:w-20" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-auto h-7 w-28" />
          </div>
        </div>
      );
    default:
      return assertNever(state);
  }
}

function NextReadCandidates({
  candidates,
  isIncomplete,
}: {
  candidates: readonly HomeNextReadCandidate[];
  isIncomplete: boolean;
}) {
  const t = useTranslations("home.nextRead");
  const [selectedId, setSelectedId] = useState<Nullable<string>>(null);
  const [startTarget, setStartTarget] = useState<Nullable<StartTarget>>(null);
  const changeStatus = useChangeReadingStatus();
  const candidate = selectNextReadCandidate({ candidates, selectedId });
  if (candidate === null) return null;

  const followingId = followingNextReadId({ candidates, currentId: candidate.book.id });
  const actionLabel = nextReadActionLabel(candidate);

  function startReading(target: HomeNextReadCandidate) {
    if (changeStatus.isPending) return;
    if (nextReadFlow(target) === "queueDialog") {
      setStartTarget({ id: target.book.id, title: target.book.title });
      return;
    }
    changeStatus.mutate(
      { id: target.book.id, payload: { status: "reading" } },
      {
        onError: () => toast.error(t("startError")),
        onSuccess: () => toast.success(t("started", { title: target.book.title })),
      },
    );
  }

  return (
    <div className="@container/next-read flex flex-1 flex-col gap-3">
      {isIncomplete ? (
        <p className="flex items-start gap-2 text-xs text-muted-foreground" role="status">
          <UiIcon aria-hidden className="mt-px shrink-0 text-info" name="info" size={14} />
          {t("incomplete.note")}
        </p>
      ) : null}
      <div className="flex min-w-0 gap-3">
        <Link
          aria-hidden
          className="w-16 shrink-0 cursor-pointer @xs/next-read:w-20"
          href={homeBookHref(candidate.book.id)}
          tabIndex={-1}
        >
          <HomeBookCover className="w-full" cover={candidate.book.cover} sizes="5rem" />
        </Link>
        <CandidateDetails candidate={candidate} />
        <Image
          alt=""
          aria-hidden
          className="pointer-events-none hidden h-auto w-20 shrink-0 self-start object-contain select-none @md/next-read:block"
          height={NEXT_READ_ILLUSTRATION.height}
          loading="lazy"
          src={NEXT_READ_ILLUSTRATION.src}
          unoptimized
          width={NEXT_READ_ILLUSTRATION.width}
        />
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Button loading={changeStatus.isPending} onClick={() => startReading(candidate)} size="sm">
          <UiIcon aria-hidden name={NEXT_READ_ACTION_ICON[actionLabel]} size={14} />
          {t(`action.${actionLabel}`)}
        </Button>
        {followingId === null ? null : (
          <Button
            disabled={changeStatus.isPending}
            onClick={() => setSelectedId(followingId)}
            size="sm"
            variant="ghost"
          >
            <UiIcon aria-hidden name="swap" size={14} />
            {t("another")}
          </Button>
        )}
      </div>

      <StartReadingDialog
        book={startTarget}
        onOpenChange={(open) => {
          if (!open) setStartTarget(null);
        }}
      />
    </div>
  );
}
