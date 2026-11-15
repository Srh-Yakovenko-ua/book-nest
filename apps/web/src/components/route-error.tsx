"use client";

import { ArrowLeft, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { buildDocumentTitle } from "@/lib/document-title";
import { focusOnMount } from "@/lib/focus-on-mount";

export function RouteError({ reset }: { reset: () => void }) {
  const t = useTranslations("error");
  const tHome = useTranslations("home");

  return (
    <>
      <title>{buildDocumentTitle({ appName: tHome("title"), page: t("headline") })}</title>
      <section className="flex-1">
        <p className="font-mono text-xs tracking-[0.24em] text-muted-foreground uppercase">
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

        <div className="mt-3 h-0.5 w-12 rounded-full bg-gradient-to-r from-error to-error/40" />

        <p className="mt-8 max-w-180 text-base leading-relaxed text-foreground md:text-lg">
          {t("description")}
        </p>
      </section>

      <footer className="mt-16 flex flex-col items-start justify-between gap-6 border-t border-border pt-8 md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            asChild
            className="h-12 cursor-pointer px-6 font-mono text-xs tracking-[0.22em] uppercase transition-all duration-150 hover:ring-4 hover:ring-primary/15"
            variant="outline"
          >
            <Link href="/">
              <ArrowLeft className="mr-2 size-4" />
              {t("backHome")}
            </Link>
          </Button>

          <Button
            className="h-12 cursor-pointer px-6 font-mono text-xs tracking-[0.22em] uppercase transition-all duration-150 hover:shadow-glow-brand"
            onClick={reset}
            variant="default"
          >
            <RefreshCw className="mr-2 size-4" />
            {t("reload")}
          </Button>
        </div>
      </footer>
    </>
  );
}
