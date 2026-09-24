"use client";

import type { LibraryPublisherDetail } from "@app/shared";
import type { Ref } from "react";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { publisherCountryLabel } from "../model/publisher-format";

type PublisherDetailsHeroProps = {
  actionsMenuRef: Ref<HTMLButtonElement>;
  details: LibraryPublisherDetail;
  onAddBook: () => void;
  onDelete: () => void;
  onEdit: () => void;
};

export function PublisherDetailsHero({
  actionsMenuRef,
  details,
  onAddBook,
  onDelete,
  onEdit,
}: PublisherDetailsHeroProps) {
  const t = useTranslations("publishers.details.hero");
  const locale = useLocale();
  const countryLabel = publisherCountryLabel(details.countryCode, locale, "");

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-soft sm:flex-row sm:items-center sm:justify-between sm:gap-6 md:p-7">
      <div className="flex min-w-0 items-start gap-4">
        <span
          aria-hidden
          className="grid size-14 shrink-0 place-items-center rounded-2xl bg-accent text-primary"
        >
          <UiIcon name="building" size={26} />
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="font-heading text-2xl leading-tight font-semibold break-words text-ink md:text-3xl">
            {details.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground empty:hidden">
            {countryLabel === "" ? null : (
              <span className="inline-flex items-center gap-1.5">
                <UiIcon aria-hidden className="shrink-0 text-icon" name="globe" size={15} />
                {countryLabel}
              </span>
            )}
            {details.foundedYear === null ? null : (
              <span className="inline-flex items-center gap-1.5">
                <UiIcon aria-hidden className="shrink-0 text-icon" name="calendar" size={15} />
                {t("foundedYear", { year: details.foundedYear })}
              </span>
            )}
            {details.websiteUrl === null ? null : (
              <a
                aria-label={t("websiteLabel")}
                className="inline-flex items-center gap-1.5 font-medium text-primary no-underline transition-colors outline-none hover:text-primary-hover focus-visible:text-primary-hover"
                href={details.websiteUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <UiIcon aria-hidden className="shrink-0" name="external" size={15} />
                {t("website")}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button className="flex-1 sm:flex-none" onClick={onAddBook}>
          <UiIcon name="plus" size={16} />
          {t("addBook")}
        </Button>
        {details.isCustom ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label={t("menu")} ref={actionsMenuRef} size="icon" variant="outline">
                <UiIcon name="more" size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={onEdit}>
                <UiIcon name="edit" size={16} />
                {t("edit")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onDelete} variant="destructive">
                <UiIcon name="trash" size={16} />
                {t("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </section>
  );
}
