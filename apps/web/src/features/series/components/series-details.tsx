"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/http-client";
import { cn } from "@/lib/utils";

import { useSeriesDetails } from "../api/use-series-details";
import { SeriesDetailsView } from "./series-details-view";

type SeriesDetailsProps = {
  id: string;
};

export function SeriesDetails({ id }: SeriesDetailsProps) {
  const t = useTranslations("series.details.states");
  const router = useRouter();
  const { data: details, error, isPending } = useSeriesDetails(id);

  if (isPending) {
    return (
      <output aria-busy="true" aria-label={t("loading")} className="flex flex-col gap-6 lg:gap-8">
        <Skeleton className="h-6 w-24 rounded-md" />
        <Skeleton className="h-52 w-full rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-8">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-9 w-56 rounded-lg" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
          <div className="hidden flex-col gap-6 lg:flex">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-52 w-full rounded-xl" />
          </div>
        </div>
      </output>
    );
  }

  if (error !== null) {
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
        <Button onClick={() => router.push("/series")} variant="secondary">
          <UiIcon name="arrow-left" size={16} />
          {t("back")}
        </Button>
      </div>
    );
  }

  return <SeriesDetailsView details={details} />;
}
