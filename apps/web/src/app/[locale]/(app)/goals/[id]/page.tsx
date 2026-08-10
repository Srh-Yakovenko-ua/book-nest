import type { Metadata } from "next";

import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { GoalDetails } from "@/features/reading-goals";
import { routing } from "@/i18n/routing";

type Props = {
  params: Promise<{ id: string; locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: resolvedLocale, namespace: "goals.detail" });
  return { title: t("metaTitle") };
}

export default async function GoalDetailsPage({ params }: Props) {
  const { id, locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 pt-8 pb-16 md:px-8 lg:px-12">
      <GoalDetails id={id} />
    </main>
  );
}
