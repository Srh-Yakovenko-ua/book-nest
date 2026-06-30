import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { Providers } from "@/components/providers";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "@/features/auth";
import { routing } from "@/i18n/routing";
import { env } from "@/lib/env";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: resolvedLocale, namespace: "home" });

  return {
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
    },
    description: t("description"),
    icons: { icon: "/favicon.svg" },
    metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
    title: {
      default: t("title"),
      template: `%s · ${t("title")}`,
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { color: "#F6F0E7", media: "(prefers-color-scheme: light)" },
    { color: "#17120E", media: "(prefers-color-scheme: dark)" },
  ],
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        <NextIntlClientProvider>
          <ThemeProvider>
            <Providers>
              <SessionProvider>{children}</SessionProvider>
            </Providers>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
