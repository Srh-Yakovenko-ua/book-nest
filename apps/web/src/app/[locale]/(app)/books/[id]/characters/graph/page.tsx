import type { Metadata } from "next";

import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { BookGraphWorkspace } from "@/features/character-relationships";
import { routing } from "@/i18n/routing";

type Props = {
  params: Promise<{ id: string; locale: string }>;
};

export default async function BookGraphWorkspacePage({ params }: Props) {
  const { id, locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <main className="mx-auto w-full max-w-480 flex-1 px-4 pt-6 pb-12 md:px-6 lg:px-8">
      <BookGraphWorkspace bookId={id} />
    </main>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: resolvedLocale, namespace: "relationships.workspace" });
  return { title: t("metaTitle") };
}
