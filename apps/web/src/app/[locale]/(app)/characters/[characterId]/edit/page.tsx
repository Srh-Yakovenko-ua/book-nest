import type { Metadata } from "next";

import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { CharacterEditPage } from "@/features/characters";
import { routing } from "@/i18n/routing";

type Props = {
  params: Promise<{ characterId: string; locale: string }>;
};

export default async function EditCharacterPage({ params }: Props) {
  const { characterId, locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "characters.edit" });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 pt-8 pb-16 md:px-8 lg:px-12">
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="font-heading text-[clamp(1.5rem,3vw,2.25rem)] leading-tight font-semibold text-ink">
          {t("title")}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{t("subtitle")}</p>
      </header>

      <CharacterEditPage characterId={characterId} />
    </main>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: resolvedLocale, namespace: "characters.edit" });
  return { title: t("metaTitle") };
}
