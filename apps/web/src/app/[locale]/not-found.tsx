import { BookCopy, Home, Library, ListOrdered } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

const QUICK_LINKS = [
  { href: "/", icon: Home, key: "home" },
  { href: "/my-library", icon: Library, key: "myLibrary" },
  { href: "/series", icon: BookCopy, key: "series" },
  { href: "/reading-queue", icon: ListOrdered, key: "readingQueue" },
] as const;

export default async function NotFound() {
  const t = await getTranslations("notFound");
  const tNav = await getTranslations("nav");
  const locale = await getLocale();
  const illuLocale = locale === "en" ? "en" : "uk";

  return (
    <main className="flex min-h-screen flex-col items-center px-5 py-16 text-center md:px-8">
      <p className="animate-in font-display text-[clamp(4rem,12vw,9rem)] leading-[0.86] font-normal tracking-[-0.038em] duration-700 fill-mode-both fade-in slide-in-from-bottom-3">
        404<span className="text-primary">.</span>
      </p>

      <h1 className="mt-8 animate-in font-display text-2xl font-normal text-foreground delay-100 duration-700 fill-mode-both fade-in slide-in-from-bottom-3 sm:text-3xl">
        {t("title")}
      </h1>

      <p className="mt-3 max-w-md animate-in text-base leading-relaxed text-muted-foreground delay-150 duration-700 fill-mode-both fade-in slide-in-from-bottom-3">
        {t("description")}
      </p>

      <Image
        alt=""
        className="mt-8 h-auto w-72 animate-in delay-200 duration-700 fill-mode-both select-none zoom-in-95 fade-in sm:w-130"
        height={1024}
        priority={false}
        src={`/illustrations/error-404-${illuLocale}.png`}
        width={1536}
      />

      <h2 className="mt-10 animate-in font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase delay-300 duration-700 fill-mode-both fade-in slide-in-from-bottom-3">
        {t("quickLinks")}
      </h2>

      <nav className="mt-4 grid w-full max-w-md animate-in grid-cols-2 gap-3 delay-300 duration-700 fill-mode-both fade-in slide-in-from-bottom-3 sm:flex sm:max-w-none sm:flex-wrap sm:justify-center">
        {QUICK_LINKS.map(({ href, icon: Icon, key }) => (
          <Button asChild key={key} variant="outline">
            <Link href={href}>
              <Icon className="size-4" />
              {tNav(key)}
            </Link>
          </Button>
        ))}
      </nav>
    </main>
  );
}
