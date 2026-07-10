"use client";

import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { useSeriesDetails } from "@/features/series/api/use-series-details";

import type { BookFormInitialSeries } from "../model/create-book-form";

import { BookForm } from "./book-form";

type CreateBookFormProps = {
  partNumber?: number;
  seriesId?: string;
};

export function CreateBookForm({ partNumber, seriesId }: CreateBookFormProps) {
  if (seriesId === undefined) return <BookForm mode="create" />;
  return <CreateBookInSeries partNumber={partNumber} seriesId={seriesId} />;
}

function CreateBookInSeries({ partNumber, seriesId }: { partNumber?: number; seriesId: string }) {
  const t = useTranslations("books");
  const { data: series, isError, isPending } = useSeriesDetails(seriesId);

  if (isPending) {
    return (
      <output
        aria-busy="true"
        aria-label={t("editState.loading")}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"
      >
        <div className="flex flex-col gap-6">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-80 w-full rounded-2xl" />
      </output>
    );
  }

  if (isError) return <BookForm mode="create" />;

  const initialSeries: BookFormInitialSeries = {
    partNumber,
    selection: {
      authors: series.authors.map((author) => ({
        id: author.id,
        kind: "catalog",
        name: author.name,
      })),
      genres: series.genres,
      id: series.id,
      kind: "existing",
      name: series.name,
      totalBooks: series.totalBooks ?? undefined,
    },
  };

  return <BookForm initialSeries={initialSeries} mode="create" />;
}
