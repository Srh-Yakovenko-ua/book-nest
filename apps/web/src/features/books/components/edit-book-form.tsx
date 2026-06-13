"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/http-client";

import { useBook } from "../api/use-book";
import { BookForm } from "./book-form";

type EditBookFormProps = {
  id: string;
};

export function EditBookForm({ id }: EditBookFormProps) {
  const t = useTranslations("books");
  const router = useRouter();
  const { data: book, error, isPending } = useBook(id);

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

  if (error !== null) {
    const isNotFound = error instanceof ApiError && error.status === 404;
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
        <Button onClick={() => router.push("/")} variant="secondary">
          {t("editState.backToLibrary")}
        </Button>
      </div>
    );
  }

  return <BookForm book={book} mode="edit" />;
}
