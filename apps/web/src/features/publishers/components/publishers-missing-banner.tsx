"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";

type PublishersMissingBannerProps = {
  count: number;
};

export function PublishersMissingBanner({ count }: PublishersMissingBannerProps) {
  const t = useTranslations("publishers.banner");

  if (count <= 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-accent/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <UiIcon aria-hidden className="mt-0.5 shrink-0 text-icon" name="info" size={18} />
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-ink">{t("title", { count })}</p>
          <p className="text-[0.8125rem] text-muted-foreground">{t("description")}</p>
        </div>
      </div>
      <Link
        className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md text-sm font-medium text-primary no-underline transition-colors outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:self-auto"
        href="/books?publisherPresence=missing"
      >
        {t("action")}
        <UiIcon aria-hidden name="arrow-right" size={15} />
      </Link>
    </div>
  );
}
