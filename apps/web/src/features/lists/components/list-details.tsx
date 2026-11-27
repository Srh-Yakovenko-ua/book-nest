"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Illustration } from "@/components/illustration";
import { RefetchErrorBanner } from "@/components/refetch-error-banner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { infiniteScrollStateOf } from "@/hooks/use-infinite-scroll-sentinel";
import { useRouter } from "@/i18n/navigation";
import { HTTP_STATUS, isApiErrorStatus } from "@/lib/api-errors";
import { focusOnMount } from "@/lib/focus-on-mount";

import { useListDetail } from "../api/use-list-detail";
import { useListDetailQuery } from "../model/use-list-detail-query";
import { ListDetailsView } from "./list-details-view";

type ListDetailsProps = {
  id: string;
};

export function ListDetails({ id }: ListDetailsProps) {
  const t = useTranslations("lists.details.states");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { params } = useListDetailQuery();
  const [retriedFirstLoad, setRetriedFirstLoad] = useState(false);

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    isLoadingError,
    isPending,
    isPlaceholderData,
    isRefetchError,
    isRefetching,
    refetch,
  } = useListDetail(id, params);

  if (isPending) {
    return (
      <output aria-busy="true" aria-label={t("loading")} className="flex flex-col gap-6 lg:gap-8">
        <Skeleton className="h-6 w-40 rounded-md" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-9 w-64 rounded-lg" />
          <Skeleton className="h-5 w-full max-w-xl rounded-md" />
          <Skeleton className="h-4 w-48 rounded-md" />
        </div>
        <Skeleton className="h-10 w-full rounded-md" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton className="h-44 w-full rounded-xl" key={index} />
          ))}
        </div>
      </output>
    );
  }

  const isNotFound = isApiErrorStatus(error, HTTP_STATUS.notFound);

  if (isLoadingError || (isRefetchError && isNotFound)) {
    return (
      <div
        className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-16 text-center motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
        role="alert"
      >
        <Illustration name={isNotFound ? "error-not-found" : "error-generic"} size="sm" />
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-xl font-medium text-ink">
            {isNotFound ? t("notFoundTitle") : t("errorTitle")}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isNotFound ? t("notFoundDescription") : t("errorDescription")}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {isNotFound ? null : (
            <Button
              onClick={() => {
                setRetriedFirstLoad(true);
                void refetch();
              }}
              ref={retriedFirstLoad ? focusOnMount : undefined}
            >
              <UiIcon name="refresh" size={16} />
              {tCommon("retry")}
            </Button>
          )}
          <Button onClick={() => router.push("/lists")} variant="secondary">
            <UiIcon name="arrow-left" size={16} />
            {t("back")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <RefetchErrorBanner
        state={isRefetchError ? { isRetrying: isRefetching, onRetry: () => void refetch() } : null}
      />
      <ListDetailsView
        id={id}
        isFetching={isFetching}
        isRefreshing={isPlaceholderData}
        loadMoreState={infiniteScrollStateOf({
          hasNextPage,
          isFetchingNextPage,
          isFetchNextPageError,
        })}
        onLoadMore={() => {
          void fetchNextPage();
        }}
        pages={data?.pages ?? []}
        titleRef={retriedFirstLoad ? focusOnMount : undefined}
      />
    </div>
  );
}
