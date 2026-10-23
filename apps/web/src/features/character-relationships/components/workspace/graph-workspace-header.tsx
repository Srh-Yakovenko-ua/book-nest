"use client";

import type { BookDetailsView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { getBookCharactersListPath } from "../../model/workspace/graph-workspace-routes";

export function GraphWorkspaceHeader({ book }: { book: BookDetailsView }) {
  const t = useTranslations("relationships.workspace.header");
  const charactersPath = getBookCharactersListPath(book.id);

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <nav aria-label={t("breadcrumb")}>
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <li>
              <Link className="hover:text-foreground" href={`/books/${book.id}`}>
                {book.title}
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link className="hover:text-foreground" href={charactersPath}>
                {t("characters")}
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page">{t("title")}</li>
          </ol>
        </nav>
        <h1 className="font-heading text-2xl font-medium">{t("title")}</h1>
      </div>
      <Button asChild className="self-start sm:self-auto" variant="outline">
        <Link href={charactersPath}>
          <UiIcon name="arrow-left" size={16} />
          {t("back")}
        </Link>
      </Button>
    </header>
  );
}
