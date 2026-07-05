"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/http-client";
import { cn } from "@/lib/utils";

import { useBook } from "../api/use-book";
import { BookDetailsView } from "./book-details-view";

type BookDetailsProps = {
  id: string;
};

export function BookDetails({ id }: BookDetailsProps) {
  const t = useTranslations("books.details");
  const router = useRouter();
  const { data: book, error, isPending } = useBook(id);

  if (isPending) {
    return (
      <output
        aria-busy="true"
        aria-label={t("states.loading")}
        className="flex flex-col gap-6 lg:gap-8"
      >
        <Skeleton className="h-64 w-full rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <div className="flex flex-col gap-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
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
            {isNotFound ? t("states.notFoundTitle") : t("states.errorTitle")}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isNotFound ? t("states.notFoundDescription") : t("states.errorDescription")}
          </p>
        </div>
        <Button onClick={() => router.push("/books")} variant="secondary">
          <UiIcon name="arrow-left" size={16} />
          {t("backToLibrary")}
        </Button>
      </div>
    );
  }

  return <BookDetailsView book={book} />;
}
