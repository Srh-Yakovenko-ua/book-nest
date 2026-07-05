import type { Metadata } from "next";

import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { notFound } from "next/navigation";

import { EditBookForm } from "@/features/books";
import { routing } from "@/i18n/routing";

type Props = {
  params: Promise<{ id: string; locale: string }>;
};

export default async function EditBookPage({ params }: Props) {
  const { id, locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "books" });

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-5 pt-8 pb-16 md:px-8 lg:px-12">
      <header className="mb-8 flex flex-col gap-2 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1 md:mb-10">
        <div className="flex items-center gap-3">
          <Image
            alt=""
            aria-hidden
            className="h-auto w-14 shrink-0 select-none"
            height={809}
            src="/illustrations/pen.png"
            unoptimized
            width={860}
          />
          <h1 className="font-heading text-[clamp(1.875rem,4vw,2.75rem)] leading-tight font-semibold text-ink">
            {t("editPage.title")}
          </h1>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          {t("editPage.subtitle")}
        </p>
      </header>

      <EditBookForm id={id} />
    </main>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: resolvedLocale, namespace: "books" });
  return { title: t("editPage.metaTitle") };
}
