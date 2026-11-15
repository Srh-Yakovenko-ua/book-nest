"use client";

import { ArrowLeft, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { buildDocumentTitle } from "@/lib/document-title";
import { focusOnMount } from "@/lib/focus-on-mount";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");
  const tHome = useTranslations("home");

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <title>{buildDocumentTitle({ appName: tHome("title"), page: t("headline") })}</title>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 15% 0%, oklch(0.62 0.22 25 / 0.18), transparent 60%),
            radial-gradient(ellipse 60% 60% at 100% 100%, oklch(0.28 0.1 280 / 0.2), transparent 65%)
          `,
        }}
      />

      <main className="relative flex min-h-screen flex-col px-8 py-10 md:px-16 md:py-14 lg:px-24 lg:py-16">
        <section className="mt-20 flex-1 md:mt-28 lg:mt-32">
          <p className="font-mono text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
            {t("eyebrow")}
          </p>

          <h1
            className="mt-6 font-display text-[clamp(2rem,4vw,3.5rem)] leading-[0.86] font-semibold tracking-[-0.035em] outline-none"
            ref={focusOnMount}
            tabIndex={-1}
          >
            {t("headline")}
            <span className="text-error">.</span>
          </h1>

          <div className="mt-3 h-[2px] w-12 rounded-full bg-gradient-to-r from-error to-error/40" />

          <p className="mt-8 max-w-[720px] text-base leading-relaxed text-foreground md:text-lg">
            {t("description")}
          </p>
        </section>

        <footer className="mt-16 flex flex-col items-start justify-between gap-6 border-t border-border pt-8 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <Button
              asChild
              className="h-12 cursor-pointer px-6 font-mono text-[11px] tracking-[0.22em] uppercase transition-all duration-150 hover:ring-4 hover:ring-primary/15"
              variant="outline"
            >
              <Link href="/">
                <ArrowLeft className="mr-2 size-4" />
                {t("backHome")}
              </Link>
            </Button>

            <Button
              className="h-12 cursor-pointer px-6 font-mono text-[11px] tracking-[0.22em] uppercase transition-all duration-150 hover:shadow-[var(--shadow-glow-brand)]"
              onClick={reset}
              variant="default"
            >
              <RefreshCw className="mr-2 size-4" />
              {t("reload")}
            </Button>
          </div>
        </footer>
      </main>
    </div>
  );
}
