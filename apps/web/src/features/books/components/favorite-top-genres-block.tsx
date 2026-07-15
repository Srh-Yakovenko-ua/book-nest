"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useFavoritesSummary } from "../api/use-favorites-summary";
import { useGenres } from "../api/use-genres";
import { LibraryGenresPie } from "./library-genres-pie";

type GenreSlice = {
  count: number;
  key: string;
  name: string;
};

export function FavoriteTopGenresBlock() {
  const t = useTranslations("favorites.topGenres");
  const summary = useFavoritesSummary();
  const genres = useGenres();

  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));

  const slices = (summary.data?.topGenres ?? []).slice(0, 3).map((genre) => ({
    count: genre.count,
    key: genre.genre,
    name: genreNameByKey.get(genre.genre) ?? genre.genre,
  }));

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-card">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-primary">
            <UiIcon aria-hidden name="pie" size={16} />
          </span>
          <h2 className="font-heading text-[0.9375rem] font-semibold text-ink">{t("title")}</h2>
        </div>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </header>

      <FavoriteTopGenresContent
        ariaLabel={t("chartLabel")}
        emptyLabel={t("empty")}
        errorLabel={t("error")}
        isError={summary.isError}
        isPending={summary.isPending}
        onRetry={() => void summary.refetch()}
        retryLabel={t("retry")}
        slices={slices}
      />
    </section>
  );
}

function FavoriteTopGenresContent({
  ariaLabel,
  emptyLabel,
  errorLabel,
  isError,
  isPending,
  onRetry,
  retryLabel,
  slices,
}: {
  ariaLabel: string;
  emptyLabel: string;
  errorLabel: string;
  isError: boolean;
  isPending: boolean;
  onRetry: () => void;
  retryLabel: string;
  slices: GenreSlice[];
}) {
  if (isPending) {
    return <FavoriteTopGenresSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-2" role="status">
        <p className="text-xs text-muted-foreground">{errorLabel}</p>
        <Button onClick={onRetry} size="sm" variant="outline">
          <UiIcon name="refresh" size={14} />
          {retryLabel}
        </Button>
      </div>
    );
  }

  if (slices.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }

  return <LibraryGenresPie ariaLabel={ariaLabel} genres={slices} />;
}

function FavoriteTopGenresSkeleton() {
  return (
    <div aria-busy className="flex flex-col items-center gap-4">
      <Skeleton className="size-[140px] shrink-0 rounded-full" />
      <div className="flex w-full flex-col gap-1.5">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton className="h-4 w-full" key={index} />
        ))}
      </div>
    </div>
  );
}
