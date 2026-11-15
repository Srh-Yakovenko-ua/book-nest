"use client";

import { RefreshCw } from "lucide-react";
import { hasLocale } from "next-intl";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { type Locale, routing } from "@/i18n/routing";
import { focusOnMount } from "@/lib/focus-on-mount";
import en from "@/messages/global-error/en.json";
import uk from "@/messages/global-error/uk.json";
import "@/styles/globals.css";

const MESSAGES = { en, uk } satisfies Record<Locale, typeof en>;

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { locale } = useParams();
  const resolvedLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const messages = MESSAGES[resolvedLocale];

  return (
    <html lang={resolvedLocale}>
      <body className="bg-background text-foreground antialiased">
        <title>{messages.documentTitle}</title>
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="space-y-2">
            <p className="font-mono text-[10px] tracking-[0.26em] text-muted-foreground uppercase">
              {messages.eyebrow}
            </p>
            <h1
              className="font-display text-4xl font-semibold outline-none"
              ref={focusOnMount}
              tabIndex={-1}
            >
              {messages.headline}
              <span className="text-error">.</span>
            </h1>
          </div>
          <Button className="cursor-pointer" onClick={reset} variant="default">
            <RefreshCw className="mr-2 size-4" />
            {messages.reload}
          </Button>
        </main>
      </body>
    </html>
  );
}
