import { useTranslation } from "react-i18next";

import { usePageTitle } from "@/hooks/use-page-title";
import { cn } from "@/lib/utils";

export function HomePage() {
  const { t } = useTranslation();
  usePageTitle(t("home.title"));

  return (
    <main className="relative flex flex-1 flex-col px-5 pb-10 md:px-8 md:pb-14 lg:px-12 lg:pb-16">
      <section className="mt-10 flex-1 md:mt-14 lg:mt-16">
        <p className="animate-in font-mono text-[10px] tracking-[0.26em] text-muted-foreground uppercase duration-700 fill-mode-both fade-in slide-in-from-bottom-2">
          {t("home.eyebrow")}
        </p>

        <h1
          className={cn(
            "mt-4 animate-in delay-100 duration-700 fill-mode-both fade-in slide-in-from-bottom-3",
            "font-display leading-[0.9] font-normal",
            "text-[clamp(2.5rem,7vw,6rem)]",
          )}
          style={{ letterSpacing: "-0.038em" }}
        >
          {t("home.title")}
          <span className="text-primary">.</span>
        </h1>

        <div className="mt-3 h-0.5 w-12 rounded-full bg-gradient-to-r from-primary/60 to-primary/0" />

        <p className="mt-6 max-w-xl animate-in text-base leading-relaxed text-muted-foreground delay-200 duration-700 fill-mode-both fade-in slide-in-from-bottom-3 md:text-lg">
          {t("home.description")}
        </p>
      </section>
    </main>
  );
}
