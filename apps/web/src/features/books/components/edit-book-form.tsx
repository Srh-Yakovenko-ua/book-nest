"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { RefetchErrorBanner } from "@/components/refetch-error-banner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "@/i18n/navigation";
import { focusOnMount } from "@/lib/focus-on-mount";
import { ApiError } from "@/lib/http-client";

import { useBook } from "../api/use-book";
import { BookForm } from "./book-form";

type EditBookFormProps = {
  id: string;
};

export function EditBookForm({ id }: EditBookFormProps) {
  const t = useTranslations("books");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [retriedFirstLoad, setRetriedFirstLoad] = useState(false);
  const {
    data: book,
    error,
    isLoadingError,
    isPending,
    isRefetchError,
    isRefetching,
    refetch,
  } = useBook(id);

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
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-80 w-full rounded-2xl" />
      </output>
    );
  }

  const isNotFound = error instanceof ApiError && error.status === 404;

  if (isLoadingError || (isRefetchError && isNotFound)) {
    return (
      <div
        className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-16 text-center"
        role="alert"
      >
        <span className="grid size-14 place-items-center rounded-full bg-accent text-icon">
          <UiIcon name="alert-triangle" size={28} />
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-xl font-medium text-ink">
            {isNotFound ? t("editState.notFoundTitle") : t("editState.errorTitle")}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isNotFound ? t("editState.notFoundDescription") : t("editState.errorDescription")}
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
          <Button onClick={() => router.push("/")} variant="secondary">
            {t("editState.backToLibrary")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" ref={retriedFirstLoad ? focusTitleField : undefined}>
      <RefetchErrorBanner
        state={isRefetchError ? { isRetrying: isRefetching, onRetry: () => void refetch() } : null}
      />
      <BookForm book={book} key={book.updatedAt} mode="edit" />
    </div>
  );
}

function focusTitleField(container: Nullable<HTMLElement>) {
  const titleField = container?.querySelector("#book-title");
  if (titleField instanceof HTMLInputElement) titleField.focus();
}
