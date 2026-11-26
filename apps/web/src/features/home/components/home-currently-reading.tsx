"use client";

import type { HomeActiveBooksPage } from "@app/shared";

import { useTranslations } from "next-intl";
import Image from "next/image";

import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { assertNever } from "@/lib/assert-never";

import type { HomeReadingWidget } from "../model/home-reading";

import { HOME_CONTEXT_LINKS } from "../model/home-context-links";
import { HOME_LIBRARY_LINKS } from "../model/home-library-links";
import { HomeActiveBooksCarousel } from "./home-active-books-carousel";
import { HomeCard } from "./home-card";
import { HomeHeaderLink } from "./home-header-link";
import { HomeSectionError } from "./home-section-error";
import { HomeStaleNotice } from "./home-stale-notice";

type HomeCurrentlyReadingProps = {
  isQueueConfirmedEmpty: boolean;
  isRetrying: boolean;
  onRetry: () => void;
  today: string;
  updatedAt: number;
  widget: HomeReadingWidget<HomeActiveBooksPage>;
};

const READING_EMPTY_ILLUSTRATION = {
  height: 216,
  src: "/illustrations/home/home-reading-empty.png",
  width: 360,
} as const;

export function HomeCurrentlyReading(props: HomeCurrentlyReadingProps) {
  const t = useTranslations("home.reading");
  const { widget } = props;
  const total = widget.kind === "fresh" || widget.kind === "stale" ? widget.data.total : null;

  return (
    <HomeCard
      action={
        total === null || total === 0 ? null : (
          <HomeHeaderLink href={HOME_LIBRARY_LINKS.counts.reading}>
            {t("all", { count: total })}
          </HomeHeaderLink>
        )
      }
      className="h-full"
      icon="book-open-text"
      title={t("title")}
    >
      <CurrentlyReadingBody {...props} />
    </HomeCard>
  );
}

function CurrentlyReadingBody({
  isQueueConfirmedEmpty,
  isRetrying,
  onRetry,
  today,
  updatedAt,
  widget,
}: HomeCurrentlyReadingProps) {
  const t = useTranslations("home.reading");
  const tCommon = useTranslations("common");

  switch (widget.kind) {
    case "error":
      return (
        <HomeSectionError
          isRetrying={isRetrying}
          onRetry={onRetry}
          retryLabel={t("error.retry")}
          title={t("error.title")}
        />
      );
    case "fresh":
    case "stale":
      return (
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {widget.kind === "stale" ? (
            <HomeStaleNotice isRetrying={isRetrying} onRetry={onRetry} />
          ) : null}
          <HomeActiveBooksCarousel
            empty={<ReadingEmpty isQueueConfirmedEmpty={isQueueConfirmedEmpty} />}
            initialPage={widget.data}
            initialPageUpdatedAt={updatedAt}
            today={today}
          />
        </div>
      );
    case "loading":
      return (
        <div aria-busy className="flex min-h-40 flex-1 gap-3 rounded-lg border border-border p-3">
          <span className="sr-only" role="status">
            {tCommon("loading")}
          </span>
          <Skeleton className="aspect-2/3 w-16 shrink-0 @md/home:w-20" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="mt-auto h-7 w-32" />
          </div>
        </div>
      );
    default:
      return assertNever(widget);
  }
}

function ReadingEmpty({ isQueueConfirmedEmpty }: { isQueueConfirmedEmpty: boolean }) {
  const t = useTranslations("home.reading.empty");

  return (
    <div className="@container/reading-empty flex flex-1 items-center gap-4">
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <p className="text-sm text-foreground">{t("description")}</p>
        <Link
          className="inline-flex cursor-pointer items-center gap-1 rounded-md text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          href={
            isQueueConfirmedEmpty
              ? HOME_LIBRARY_LINKS.counts.total
              : HOME_CONTEXT_LINKS.readingQueue
          }
        >
          {isQueueConfirmedEmpty ? t("toCatalogue") : t("toQueue")}
        </Link>
      </div>
      <Image
        alt=""
        aria-hidden
        className="pointer-events-none hidden h-auto w-36 shrink-0 object-contain select-none @sm/reading-empty:block @lg/reading-empty:w-44"
        height={READING_EMPTY_ILLUSTRATION.height}
        src={READING_EMPTY_ILLUSTRATION.src}
        unoptimized
        width={READING_EMPTY_ILLUSTRATION.width}
      />
    </div>
  );
}
