import type { Metadata } from "next";

import { type Locale, routing } from "@/i18n/routing";
import { env } from "@/lib/env";

const SITE_URL = env.NEXT_PUBLIC_SITE_URL;
const SITE_NAME = "book-nest";
const X_DEFAULT_HREFLANG = "x-default";
const OG_IMAGE_ALT = "book-nest — your personal reading library";

const OG_LOCALES = {
  en: "en_US",
  uk: "uk_UA",
} satisfies Record<Locale, string>;

type JsonLdGraph = {
  "@context": string;
  "@graph": Array<Record<string, string>>;
};

export function buildAlternates({ locale, pathname }: { locale: Locale; pathname: string }): {
  canonical: string;
  languages: Record<string, string>;
} {
  return {
    canonical: localeUrl({ locale, pathname }),
    languages: buildHreflang({ pathname }),
  };
}

export function buildHreflang({ pathname }: { pathname: string }): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = localeUrl({ locale, pathname });
  }
  languages[X_DEFAULT_HREFLANG] = localeUrl({ locale: routing.defaultLocale, pathname });
  return languages;
}

export function buildOpenGraph({
  description,
  locale,
  pathname,
  title,
}: {
  description: string;
  locale: Locale;
  pathname: string;
  title: string;
}): Metadata["openGraph"] {
  return {
    description,
    images: [
      { alt: OG_IMAGE_ALT, height: 630, url: `${SITE_URL}/${locale}/opengraph-image`, width: 1200 },
    ],
    locale: OG_LOCALES[locale],
    siteName: SITE_NAME,
    title,
    type: "website",
    url: localeUrl({ locale, pathname }),
  };
}

export function buildTwitter({
  description,
  title,
}: {
  description: string;
  title: string;
}): Metadata["twitter"] {
  return {
    card: "summary_large_image",
    description,
    title,
  };
}

export function buildWebsiteJsonLd({ locale }: { locale: Locale }): JsonLdGraph {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        inLanguage: locale,
        name: SITE_NAME,
        url: SITE_URL,
      },
      {
        "@type": "Organization",
        logo: `${SITE_URL}/favicon.svg`,
        name: SITE_NAME,
        url: SITE_URL,
      },
    ],
  };
}

function localeUrl({ locale, pathname }: { locale: string; pathname: string }): string {
  return `${SITE_URL}/${locale}${toSegment(pathname)}`;
}

function toSegment(pathname: string): string {
  return pathname === "/" ? "" : pathname;
}
