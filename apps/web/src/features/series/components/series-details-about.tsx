"use client";

import type { SeriesDetailsView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";

import { FormSection } from "@/features/books";
import { formatDateLong } from "@/lib/format";

type SeriesDetailsAboutProps = {
  details: SeriesDetailsView;
};

export function SeriesDetailsAbout({ details }: SeriesDetailsAboutProps) {
  const t = useTranslations("series.details.about");
  const locale = useLocale();

  const description = details.description?.trim() ?? "";

  return (
    <FormSection
      icon="info"
      title={
        <span className="relative inline-flex items-center">
          {t("title")}
          <Image
            alt=""
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-full ml-2 -translate-y-1/2 select-none"
            height={40}
            src="/illustrations/leaf-1.png"
            unoptimized
            width={48}
          />
        </span>
      }
    >
      {description.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("descriptionEmpty")}</p>
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">
          {description}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        {t("addedToBookNest", { date: formatDateLong(details.createdAt, locale) })}
      </p>
    </FormSection>
  );
}
