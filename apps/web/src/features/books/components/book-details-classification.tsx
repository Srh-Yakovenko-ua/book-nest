"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { type ReactNode } from "react";

import { UiIcon } from "@/components/icons";

import { useGenres } from "../api/use-genres";
import { FormSection } from "./form-section";

type BookDetailsClassificationProps = {
  book: BookView;
};

export function BookDetailsClassification({ book }: BookDetailsClassificationProps) {
  const t = useTranslations("books");
  const genres = useGenres();
  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));

  const hasGenres = book.genres.length > 0;
  const hasTags = book.tags.length > 0;
  const hasLists = book.lists.length > 0;
  const hasAgeCategory = book.ageCategory !== "not_specified";

  return (
    <FormSection icon="tag" title={t("classification.title")}>
      {hasGenres ? (
        <ClassificationRow label={t("classification.genres")}>
          <ul className="flex flex-wrap gap-1.5">
            {book.genres.map((key) => (
              <li
                className="inline-flex max-w-full items-center rounded-full border border-border bg-tag px-2.5 py-1 text-xs font-medium text-tag-foreground"
                key={key}
              >
                <span className="min-w-0 truncate">{genreNameByKey.get(key) ?? key}</span>
              </li>
            ))}
          </ul>
        </ClassificationRow>
      ) : null}

      {hasTags ? (
        <ClassificationRow label={t("classification.tags")}>
          <ul className="flex flex-wrap gap-1.5">
            {book.tags.map((tag) => (
              <li
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs font-medium text-foreground/80"
                key={tag.id}
              >
                <UiIcon className="shrink-0 text-muted-foreground" name="hash" size={12} />
                <span className="min-w-0 truncate">{tag.name}</span>
              </li>
            ))}
          </ul>
        </ClassificationRow>
      ) : null}

      {hasLists ? (
        <ClassificationRow label={t("details.lists")}>
          <ul className="flex flex-wrap gap-1.5">
            {book.lists.map((list) => (
              <li
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs font-medium text-foreground/80"
                key={list.id}
              >
                <UiIcon className="shrink-0 text-muted-foreground" name="list" size={12} />
                <span className="min-w-0 truncate">{list.name}</span>
              </li>
            ))}
          </ul>
        </ClassificationRow>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row">
        {hasAgeCategory ? (
          <ClassificationRow className="flex-1" label={t("classification.ageCategory")}>
            <p className="text-sm text-foreground/90">
              {t(`classification.ageCategoryLabels.${book.ageCategory}`)}
            </p>
          </ClassificationRow>
        ) : null}
        <ClassificationRow className="flex-1" label={t("classification.language")}>
          <p className="text-sm text-foreground/90">
            {t(`classification.languageLabels.${book.language}`)}
          </p>
        </ClassificationRow>
      </div>
    </FormSection>
  );
}

function ClassificationRow({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div className={className}>
      <p className="mb-1.5 font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}
