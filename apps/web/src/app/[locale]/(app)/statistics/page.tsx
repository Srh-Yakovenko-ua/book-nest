import type { Metadata } from "next";

import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { legacyReadingCalendarHref, StatisticsOverview } from "@/features/statistics";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: resolvedLocale, namespace: "statistics" });
  return { title: t("metaTitle") };
}

export default async function StatisticsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const readingCalendarHref = legacyReadingCalendarHref(await searchParams);
  if (readingCalendarHref !== null) redirect({ href: readingCalendarHref, locale });
  setRequestLocale(locale);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-5 pt-8 pb-16 md:px-8 lg:px-12">
      <StatisticsOverview />
    </main>
  );
}
