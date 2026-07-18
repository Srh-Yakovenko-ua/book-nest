"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "@/i18n/navigation";

import type { GenreCardItem } from "../model/genres-derive";

import { GENRE_PREVIEW_LIMIT } from "../model/genres-derive";
import { GenreCard } from "./genre-card";

const SKELETON_COUNT = 6;

type GenresTabProps = {
  genres: GenreCardItem[];
  hasAnyGenres: boolean;
  isError: boolean;
  isPending: boolean;
  onClearFilters: () => void;
  onRetry: () => void;
};

export function GenresTab({
  genres,
  hasAnyGenres,
  isError,
  isPending,
  onClearFilters,
  onRetry,
}: GenresTabProps) {
  const t = useTranslations("genresTags.genres");
  const tStates = useTranslations("genresTags.states");
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  if (isError) {
    return (
      <div aria-live="assertive" role="alert">
        <EmptyState
          onPrimary={onRetry}
          state={{
            desc: tStates("error.description"),
            illu: "error-generic",
            primary: { icon: "refresh", label: tStates("error.retry") },
            title: tStates("error.title"),
          }}
        />
      </div>
    );
  }

  if (isPending) {
    return <GenresGridSkeleton />;
  }

  if (genres.length === 0) {
    if (!hasAnyGenres) {
      return (
        <EmptyState
          onPrimary={() => router.push("/my-library")}
          state={{
            desc: t("empty.description"),
            illu: "empty-library",
            primary: { icon: "library", label: t("empty.action") },
            title: t("empty.title"),
          }}
        />
      );
    }
    return (
      <EmptyState
        onPrimary={onClearFilters}
        state={{
          desc: tStates("noResults.description"),
          illu: "empty-search",
          primary: { icon: "x", label: tStates("noResults.clear") },
          title: tStates("noResults.title"),
        }}
      />
    );
  }

  const visible = expanded ? genres : genres.slice(0, GENRE_PREVIEW_LIMIT);
  const canExpand = genres.length > GENRE_PREVIEW_LIMIT;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {visible.map((genre) => (
          <GenreCard genre={genre} key={genre.key} />
        ))}
      </div>
      {canExpand ? (
        <Button
          className="self-center"
          onClick={() => setExpanded((value) => !value)}
          variant="secondary"
        >
          {expanded ? t("showLess") : t("showAll", { count: genres.length })}
        </Button>
      ) : null}
    </div>
  );
}

function GenresGridSkeleton() {
  return (
    <div aria-busy className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div
          className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-4 shadow-card"
          key={index}
        >
          <div className="flex items-start gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
          <div className="flex gap-1.5">
            {Array.from({ length: 4 }, (_, cover) => (
              <Skeleton className="aspect-[3/4] w-9 rounded-sm" key={cover} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
