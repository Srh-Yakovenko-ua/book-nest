"use client";

import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { useBook } from "@/features/books/api/use-book";

import { GraphWorkspaceMessage } from "./graph-workspace-message";
import { GraphWorkspaceShell } from "./graph-workspace-shell";

export function BookGraphWorkspace({ bookId }: { bookId: string }) {
  const t = useTranslations("relationships.workspace.states");
  const book = useBook(bookId);

  if (book.isPending) {
    return (
      <div aria-busy className="flex flex-col gap-4" role="status">
        <span className="sr-only">{t("loading")}</span>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-128 w-full rounded-2xl" />
      </div>
    );
  }

  if (book.isError) {
    return (
      <GraphWorkspaceMessage
        action={{ label: t("error.retry"), onClick: () => void book.refetch() }}
        description={t("bookUnavailable.description")}
        title={t("bookUnavailable.title")}
      />
    );
  }

  return <GraphWorkspaceShell book={book.data} />;
}
