"use client";

import { useTranslations } from "next-intl";

import { UiIcon, type UiIconName } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { CharacterEditScope } from "../model/character-edit-form";

const SCOPE_BADGE = {
  book: {
    className: "border-accent-border bg-accent text-accent-foreground",
    icon: "book",
    label: "scopeBook",
  },
  global: {
    className: "border-border bg-secondary text-secondary-foreground",
    icon: "globe",
    label: "scopeGlobal",
  },
} as const satisfies Record<
  CharacterEditScope,
  { className: string; icon: UiIconName; label: string }
>;

export function CharacterScopeBadge({ scope }: { scope: CharacterEditScope }) {
  const t = useTranslations("characters.edit");
  const badge = SCOPE_BADGE[scope];

  return (
    <Badge
      className={cn(
        "h-7 gap-1.5 rounded-full px-2.5 py-0 text-[0.8125rem] font-semibold [&>svg]:size-3.5!",
        badge.className,
      )}
      variant="outline"
    >
      <UiIcon name={badge.icon} size={14} />
      {t(badge.label)}
    </Badge>
  );
}
