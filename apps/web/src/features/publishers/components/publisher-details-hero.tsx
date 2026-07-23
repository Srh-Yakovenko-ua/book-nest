"use client";

import type { LibraryPublisherDetail } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { publisherCountryLabel } from "../model/publisher-format";

type PublisherDetailsHeroProps = {
  details: LibraryPublisherDetail;
  onAddBook: () => void;
  onDelete: () => void;
  onEdit: () => void;
};

export function PublisherDetailsHero({
  details,
  onAddBook,
  onDelete,
  onEdit,
}: PublisherDetailsHeroProps) {
  const t = useTranslations("publishers.details");
  const locale = useLocale();
  const countryLabel = publisherCountryLabel(details.countryCode, locale, t("countryUnknown"));

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-soft md:p-7">
      <Link
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground no-underline transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
        href="/publishers"
      >
        <UiIcon aria-hidden name="arrow-left" size={15} />
        {t("breadcrumb")}
      </Link>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 items-start gap-4">
          <span
            aria-hidden
            className="grid size-14 shrink-0 place-items-center rounded-2xl bg-accent text-primary"
          >
            <UiIcon name="building" size={26} />
          </span>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl leading-tight font-semibold text-ink md:text-3xl">
                {details.name}
              </h1>
              {details.isCustom ? <Badge variant="secondary">{t("customBadge")}</Badge> : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <UiIcon aria-hidden className="shrink-0 text-icon" name="globe" size={15} />
                {countryLabel}
              </span>
              {details.foundedYear === null ? null : (
                <span className="inline-flex items-center gap-1.5">
                  <UiIcon aria-hidden className="shrink-0 text-icon" name="calendar" size={15} />
                  {t("foundedYear", { year: details.foundedYear })}
                </span>
              )}
              {details.websiteUrl === null ? null : (
                <a
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

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {details.isCustom ? (
            <>
              <Button onClick={onEdit} size="sm" variant="outline">
                <UiIcon name="edit" size={16} />
                {t("editCustom")}
              </Button>
              <Button onClick={onDelete} size="sm" variant="outline">
                <UiIcon name="trash" size={16} />
                {t("delete")}
              </Button>
            </>
          ) : null}
          <Button onClick={onAddBook} size="sm">
            <UiIcon name="plus" size={16} />
            {t("addBook")}
          </Button>
        </div>
      </div>
    </section>
  );
}
