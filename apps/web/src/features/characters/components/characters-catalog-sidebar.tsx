"use client";

import { useTranslations } from "next-intl";

export function CharactersCatalogSidebar() {
  const t = useTranslations("characters.catalog.sidebar");

  return (
    <aside className="hidden w-full shrink-0 sm:block xl:w-80">
      <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading text-base text-ink">{t("title")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("description")}</p>
      </section>
    </aside>
  );
}
