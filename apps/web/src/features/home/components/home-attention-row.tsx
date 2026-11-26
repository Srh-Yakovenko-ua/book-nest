"use client";

import type { HomeAttentionGroup } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { useHomeAttentionText } from "../hooks/use-home-attention-text";
import { HOME_ATTENTION_SEVERITY } from "../model/home-attention";
import { homeAttentionHref } from "../model/home-context-links";

export function HomeAttentionRow({ group }: { group: HomeAttentionGroup }) {
  const t = useTranslations("home.attention");
  const { detail, title } = useHomeAttentionText(group);
  const severity = HOME_ATTENTION_SEVERITY[group.severity];

  return (
    <li>
      <Link
        className="group flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        href={homeAttentionHref(group)}
      >
        <UiIcon
          aria-hidden
          className={cn("mt-0.5 shrink-0", severity.tone)}
          name={severity.icon}
          size={16}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm leading-snug wrap-anywhere text-foreground group-hover:text-primary">
            <span className="sr-only">{t(`severity.${group.severity}`)}: </span>
            {title}
          </span>
          {detail === null ? null : (
            <span className="text-xs wrap-anywhere text-muted-foreground">{detail}</span>
          )}
        </span>
        <span aria-hidden className={cn("shrink-0 text-xs font-medium", severity.tone)}>
          {t(`severity.${group.severity}`)}
        </span>
      </Link>
    </li>
  );
}
