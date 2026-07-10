"use client";

import type { ListBookSort } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/http-client";
import { cn } from "@/lib/utils";

import { useListDetail } from "../api/use-list-detail";
import { LIST_BOOK_SORT_DEFAULT } from "../model/list-book-sort";
import { ListDetailsView } from "./list-details-view";

const SEARCH_DEBOUNCE_MS = 250;

type ListDetailsProps = {
  id: string;
};

export function ListDetails({ id }: ListDetailsProps) {
  const t = useTranslations("lists.details.states");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ListBookSort>(LIST_BOOK_SORT_DEFAULT);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const { data, error, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isPending } =
    useListDetail(id, { search: debouncedSearch, sort });

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
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[repeat(auto-fill,minmax(19rem,1fr))]">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton className="h-44 w-full rounded-xl" key={index} />
          ))}
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
        <Button onClick={() => router.push("/lists")} variant="secondary">
          <UiIcon name="arrow-left" size={16} />
          {t("back")}
        </Button>
      </div>
    );
  }

  return (
    <ListDetailsView
      hasNextPage={hasNextPage}
      id={id}
      isFetching={isFetching}
      isFetchingNextPage={isFetchingNextPage}
      onClearSearch={() => setSearch("")}
      onLoadMore={() => {
        void fetchNextPage();
      }}
      onSearchChange={setSearch}
      onSortChange={setSort}
      pages={data.pages}
      search={search}
      sort={sort}
    />
  );
}
