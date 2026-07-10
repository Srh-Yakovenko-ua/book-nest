import type { ReactNode } from "react";

import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { Logo } from "@/components/brand";
import { LocalePicker } from "@/components/locale-picker";
import { ThemePicker } from "@/components/theme-picker";
import { LegalBackButton, SiteFooter } from "@/features/legal";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LegalLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-prose items-center justify-between px-4 py-4 sm:px-6">
          <Link aria-label="BookNest" className="inline-flex items-center rounded-md" href="/">
            <Logo variant="horizontal" />
          </Link>
          <div className="flex items-center gap-2">
            <LocalePicker triggerClassName="h-9 rounded-full border border-border bg-card px-3 hover:bg-secondary" />
            <ThemePicker triggerClassName="size-9 rounded-full border border-border bg-card hover:bg-secondary" />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-prose flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <LegalBackButton />
        </div>
        {children}
      </main>

      <SiteFooter />
    </div>
  );
}
