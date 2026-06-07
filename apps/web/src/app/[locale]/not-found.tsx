import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <main className="relative flex flex-1 flex-col px-5 pb-10 md:px-8 md:pb-14 lg:px-12 lg:pb-16">
      <section className="mt-10 flex-1 md:mt-14 lg:mt-16">
        <p className="animate-in font-mono text-[10px] tracking-[0.26em] text-muted-foreground uppercase duration-700 fill-mode-both fade-in slide-in-from-bottom-2">
          {t("eyebrow")}
        </p>

        <h1
          className={cn(
            "mt-4 animate-in delay-100 duration-700 fill-mode-both fade-in slide-in-from-bottom-3",
            "font-display leading-[0.86] font-normal",
            "text-[clamp(3.75rem,9.5vw,14rem)]",
          )}
          style={{ letterSpacing: "-0.038em" }}
        >
          404<span className="text-primary">.</span>
        </h1>

        <h2
          className={cn(
            "mt-3 animate-in delay-150 duration-700 fill-mode-both fade-in slide-in-from-bottom-3",
            "font-display font-normal",
            "text-[clamp(1.5rem,3vw,2.5rem)]",
            "text-muted-foreground",
          )}
          style={{ letterSpacing: "-0.02em" }}
        >
          {t("headline")}
        </h2>

        <div className="mt-2 h-0.5 w-12 rounded-full bg-gradient-to-r from-primary/60 to-primary/0" />

        <p className="mt-6 max-w-xl animate-in text-base leading-relaxed text-muted-foreground delay-200 duration-700 fill-mode-both fade-in slide-in-from-bottom-3 md:text-lg">
          {t("description")}
        </p>
      </section>

      <footer className="mt-10 flex flex-col items-start justify-between gap-5 border-t border-border pt-8 md:mt-14 md:flex-row md:items-center">
        <Button
          asChild
          className="h-11 gap-1.5 px-5 font-mono text-[10px] tracking-[0.22em] uppercase transition-all duration-150 hover:ring-4 hover:ring-primary/15"
          variant="outline"
        >
          <Link href="/">
            <ArrowLeft className="size-3.5" />
            {t("backHome")}
          </Link>
        </Button>

        <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
          {t("footer")}
        </p>
      </footer>
    </main>
  );
}
