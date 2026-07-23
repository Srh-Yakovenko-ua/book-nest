"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { usePublisherDetails } from "@/features/publishers/api/use-publisher-details";
import { useSeriesDetails } from "@/features/series/api/use-series-details";

import type { BookFormInitialSeries, PublisherSelection } from "../model/create-book-form";

import { BookForm } from "./book-form";

type CreateBookFormProps = {
  partNumber?: number;
  publisherId?: string;
  seriesId?: string;
};

export function CreateBookForm({ partNumber, publisherId, seriesId }: CreateBookFormProps) {
  return (
    <ResolvePublisher publisherId={publisherId}>
      {(initialPublisher) =>
        seriesId === undefined ? (
          <BookForm initialPublisher={initialPublisher} mode="create" />
        ) : (
          <CreateBookInSeries
            initialPublisher={initialPublisher}
            partNumber={partNumber}
            seriesId={seriesId}
          />
        )
      }
    </ResolvePublisher>
  );
}

function BookFormSkeleton() {
  const t = useTranslations("books");

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

function CreateBookInSeries({
  initialPublisher,
  partNumber,
  seriesId,
}: {
  initialPublisher?: PublisherSelection;
  partNumber?: number;
  seriesId: string;
}) {
  const { data: series, isError, isPending } = useSeriesDetails(seriesId);

  if (isPending) return <BookFormSkeleton />;

  if (isError) return <BookForm initialPublisher={initialPublisher} mode="create" />;

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

  return (
    <BookForm initialPublisher={initialPublisher} initialSeries={initialSeries} mode="create" />
  );
}

function ResolvePublisher({
  children,
  publisherId,
}: {
  children: (initialPublisher?: PublisherSelection) => ReactNode;
  publisherId?: string;
}) {
  if (publisherId === undefined) return <>{children(undefined)}</>;
  return <ResolvePublisherInner publisherId={publisherId}>{children}</ResolvePublisherInner>;
}

function ResolvePublisherInner({
  children,
  publisherId,
}: {
  children: (initialPublisher?: PublisherSelection) => ReactNode;
  publisherId: string;
}) {
  const { data, isPending } = usePublisherDetails(publisherId);

  if (isPending) return <BookFormSkeleton />;

  const initialPublisher: PublisherSelection | undefined =
    data === undefined ? undefined : { id: data.id, kind: "catalog", name: data.name };

  return <>{children(initialPublisher)}</>;
}
