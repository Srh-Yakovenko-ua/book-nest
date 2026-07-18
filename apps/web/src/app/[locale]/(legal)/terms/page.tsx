import type { Metadata } from "next";

import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { getTermsContent, LegalDocument } from "@/features/legal";
import { routing } from "@/i18n/routing";
import { buildAlternates, buildOpenGraph, buildTwitter } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: resolvedLocale, namespace: "legal.terms" });
  const title = t("metaTitle");
  const description = t("metaDescription");

  return {
    alternates: buildAlternates({ locale: resolvedLocale, pathname: "/terms" }),
    description,
    openGraph: buildOpenGraph({ description, locale: resolvedLocale, pathname: "/terms", title }),
    robots: { follow: true, index: true },
    title,
    twitter: buildTwitter({ description, title }),
  };
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return <LegalDocument {...getTermsContent(locale)} />;
}
