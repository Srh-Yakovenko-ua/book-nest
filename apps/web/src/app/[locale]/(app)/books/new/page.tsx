import type { Metadata } from "next";

import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { z } from "zod";

import { TitleLeaf } from "@/components/title-leaf";
import { CreateBookForm } from "@/features/books";
import { routing } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const seriesIdParam = z.uuid();
const publisherIdParam = z.uuid();
const partNumberParam = z.coerce.number().int().min(1).max(999);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: resolvedLocale, namespace: "books" });
  return { title: t("page.metaTitle") };
}

export default async function NewBookPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "books" });

  const query = await searchParams;
  const seriesId = seriesIdParam.safeParse(query.seriesId).data;
  const publisherId = publisherIdParam.safeParse(query.publisherId).data;
  const partNumber = partNumberParam.safeParse(query.partNumber).data;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-5 pt-8 pb-16 md:px-8 lg:px-12">
      <header className="mb-8 flex flex-col gap-2 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1 md:mb-10">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-[clamp(1.875rem,4vw,2.75rem)] leading-tight font-semibold text-ink">
            {t("page.title")}
          </h1>
          <TitleLeaf />
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          {t("page.subtitle")}
        </p>
      </header>

      <CreateBookForm partNumber={partNumber} publisherId={publisherId} seriesId={seriesId} />
    </main>
  );
}
