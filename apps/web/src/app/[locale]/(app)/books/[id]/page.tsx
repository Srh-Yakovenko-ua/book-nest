import type { Metadata } from "next";

import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { BookDetails } from "@/features/books";
import { routing } from "@/i18n/routing";

type Props = {
  params: Promise<{ id: string; locale: string }>;
};

export default async function BookDetailsPage({ params }: Props) {
  const { id, locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-8 pb-16 md:px-8 lg:px-12">
      <BookDetails id={id} />
    </main>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: resolvedLocale, namespace: "books.details" });
  return { title: t("metaTitle") };
}
