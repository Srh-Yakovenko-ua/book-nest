"use client";

import type { HomeAttentionGroup } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";

import { useHomeAttentionText } from "../hooks/use-home-attention-text";
import { HOME_ATTENTION_SEVERITY } from "../model/home-attention";
import { homeAttentionHref } from "../model/home-context-links";

export function HomeCriticalBanner({ group }: { group: HomeAttentionGroup }) {
  const t = useTranslations("home.attention");
  const { detail, title } = useHomeAttentionText(group);

  return (
    <section aria-label={t("bannerLabel")}>
      <Link
        className="group flex cursor-pointer items-center gap-3 rounded-xl border border-error/40 bg-error-soft p-3 outline-none hover:border-error focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in @2xl/home:p-4"
        href={homeAttentionHref(group)}
      >
        <UiIcon
          aria-hidden
          className="shrink-0 text-error"
          name={HOME_ATTENTION_SEVERITY.critical.icon}
          size={20}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-xs font-semibold tracking-wide text-error uppercase">
            {t("severity.critical")}
          </span>
          <span className="text-sm leading-snug font-medium wrap-anywhere text-foreground">
            {title}
          </span>
          {detail === null ? null : (
            <span className="text-xs wrap-anywhere text-muted-foreground">{detail}</span>
          )}
        </span>
        <UiIcon
          aria-hidden
          className="shrink-0 text-error transition-transform motion-safe:group-hover:translate-x-0.5"
          name="arrow-right"
          size={18}
        />
      </Link>
    </section>
  );
}
