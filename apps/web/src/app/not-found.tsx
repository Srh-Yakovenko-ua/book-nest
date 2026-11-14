import { getTranslations } from "next-intl/server";

import { routing } from "@/i18n/routing";

export default async function GlobalNotFound() {
  const t = await getTranslations({ locale: routing.defaultLocale, namespace: "notFound" });

  return (
    <html lang={routing.defaultLocale}>
      <body className="bg-background text-foreground antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="font-mono text-[10px] tracking-[0.26em] text-muted-foreground uppercase">
            404
          </p>
          <h1 className="font-display text-4xl font-normal">
            {t("title")}
            <span className="text-primary">.</span>
          </h1>
        </main>
      </body>
    </html>
  );
}
