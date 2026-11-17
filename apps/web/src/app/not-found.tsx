import { Home } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { routing } from "@/i18n/routing";
import { buildDocumentTitle } from "@/lib/document-title";

export default async function GlobalNotFound() {
  const t = await getTranslations({ locale: routing.defaultLocale, namespace: "notFound" });
  const tHome = await getTranslations({ locale: routing.defaultLocale, namespace: "home" });

  return (
    <html lang={routing.defaultLocale}>
      <body className="bg-background text-foreground antialiased">
        <title>{buildDocumentTitle({ appName: tHome("title"), page: t("title") })}</title>
        <main className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="font-mono text-[10px] tracking-[0.26em] text-muted-foreground uppercase">
            404
          </p>
          <h1 className="font-display text-4xl font-normal">
            {t("title")}
            <span className="text-primary">.</span>
          </h1>
          <Button asChild className="mt-6" variant="outline">
            <Link href="/">
              <Home className="size-4" />
              {t("backHome")}
            </Link>
          </Button>
        </main>
      </body>
    </html>
  );
}
