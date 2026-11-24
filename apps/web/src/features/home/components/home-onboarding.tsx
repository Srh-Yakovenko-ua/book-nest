"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useId } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { HOME_LIBRARY_LINKS } from "../model/home-library-links";
import { HOME_CARD_STYLES } from "./home-card";

const ONBOARDING_ILLUSTRATION = {
  height: 216,
  src: "/illustrations/home/home-reading-empty.png",
  width: 360,
} as const;

export function HomeOnboarding() {
  const t = useTranslations("home.onboarding");
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex flex-col items-center gap-4 text-center @3xl/home:flex-row @3xl/home:gap-8 @3xl/home:text-left",
        HOME_CARD_STYLES.surface,
        HOME_CARD_STYLES.padding,
      )}
    >
      <Image
        alt=""
        aria-hidden
        className="pointer-events-none h-auto w-48 shrink-0 object-contain select-none @3xl/home:w-60"
        height={ONBOARDING_ILLUSTRATION.height}
        src={ONBOARDING_ILLUSTRATION.src}
        unoptimized
        width={ONBOARDING_ILLUSTRATION.width}
      />
      <div className="flex min-w-0 flex-col items-center gap-3 @3xl/home:items-start">
        <h2
          className="font-heading text-xl leading-snug font-semibold wrap-anywhere text-ink"
          id={headingId}
        >
          {t("title")}
        </h2>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground @3xl/home:text-base">
          {t("description")}
        </p>
        <Button asChild size="lg">
          <Link href={HOME_LIBRARY_LINKS.addBook}>
            <UiIcon aria-hidden name="plus" size={18} />
            {t("action")}
          </Link>
        </Button>
      </div>
    </section>
  );
}
