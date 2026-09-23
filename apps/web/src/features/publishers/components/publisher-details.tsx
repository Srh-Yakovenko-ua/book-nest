"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/http-client";
import { cn } from "@/lib/utils";

import { usePublisherDetails } from "../api/use-publisher-details";
import { PublisherDetailsView } from "./publisher-details-view";

type PublisherDetailsProps = {
  id: string;
};

const STAT_SKELETON_KEYS = ["books", "read", "wishlist", "rating"] as const;

export function PublisherDetails({ id }: PublisherDetailsProps) {
  const t = useTranslations("publishers.details.states");
  const { data: details, error, isFetching, refetch } = usePublisherDetails(id);

  if (details !== undefined) return <PublisherDetailsView details={details} />;

  if (error === null) return <PublisherDetailsSkeleton label={t("loading")} />;

  const isNotFound = error instanceof ApiError && error.status === 404;

  return (
    <div
      className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-16 text-center motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
      role="alert"
    >
      <span
        className={cn(
          "grid size-14 place-items-center rounded-full",
          isNotFound ? "bg-accent text-icon" : "bg-error-soft text-error",
        )}
      >
        <UiIcon name={isNotFound ? "search" : "alert-triangle"} size={28} />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-xl font-medium text-ink">
          {isNotFound ? t("notFoundTitle") : t("errorTitle")}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isNotFound ? t("notFoundDescription") : t("errorDescription")}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {isNotFound ? null : (
          <Button disabled={isFetching} onClick={() => void refetch()}>
            <UiIcon name="refresh" size={16} />
            {t("retry")}
          </Button>
        )}
        <Button asChild variant={isNotFound ? "default" : "secondary"}>
          <Link href="/publishers">
            <UiIcon name="arrow-left" size={16} />
            {t("back")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function PublisherDetailsSkeleton({ label }: { label: string }) {
  return (
    <output
      aria-busy="true"
      aria-label={label}
      className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in"
    >
      <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between md:p-7">
        <div className="flex items-start gap-4">
          <Skeleton className="size-14 shrink-0 rounded-2xl" />
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-8 w-56 max-w-full rounded-lg" />
            <Skeleton className="h-4 w-40 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-9 w-full rounded-lg sm:w-36" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STAT_SKELETON_KEYS.map((key) => (
          <Skeleton className="h-24 w-full rounded-xl" key={key} />
        ))}
      </div>
      <div className="flex gap-1 border-b border-border pb-2">
        <Skeleton className="h-7 w-20 rounded-md" />
        <Skeleton className="h-7 w-20 rounded-md" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </output>
  );
}
