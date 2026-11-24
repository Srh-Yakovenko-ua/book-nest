"use client";

import type { Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatRelativeTime } from "@/lib/format";

import { homeBookHref } from "../model/home-library-links";

type HomeMemoryBookLineProps = {
  authors: string;
  bookId: string;
  bookTitle: string;
  chapter: Nullable<string>;
  page: Nullable<number>;
};

type HomeMemoryFooterProps = {
  createdAt: string;
  onOpenFull: Nullable<(trigger: HTMLButtonElement) => void>;
};

export function HomeMemoryBookLine({
  authors,
  bookId,
  bookTitle,
  chapter,
  page,
}: HomeMemoryBookLineProps) {
  const t = useTranslations("home.memory");
  const details = [
    { key: "authors", value: authors.trim() },
    { key: "page", value: page === null ? "" : t("page", { page }) },
    { key: "chapter", value: chapter?.trim() ?? "" },
  ].filter((detail) => detail.value.length > 0);

  return (
    <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground">
      <UiIcon aria-hidden className="shrink-0 text-icon" name="book" size={16} />
      <Link
        className="min-w-0 cursor-pointer rounded-sm font-medium wrap-anywhere text-ink outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
        href={homeBookHref(bookId)}
      >
        {bookTitle}
      </Link>
      {details.map((detail) => (
        <span className="flex min-w-0 items-center gap-1.5 wrap-anywhere" key={detail.key}>
          <span aria-hidden>·</span>
          {detail.value}
        </span>
      ))}
    </p>
  );
}

export function HomeMemoryFooter({ createdAt, onOpenFull }: HomeMemoryFooterProps) {
  const t = useTranslations("home.memory");
  const locale = useLocale();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">
        {t("savedAge", { age: formatRelativeTime(createdAt, locale) })}
      </span>
      {onOpenFull === null ? null : (
        <Button onClick={(event) => onOpenFull(event.currentTarget)} size="sm" variant="ghost">
          {t("openFull")}
          <UiIcon aria-hidden name="chevron-right" size={14} />
        </Button>
      )}
    </div>
  );
}
