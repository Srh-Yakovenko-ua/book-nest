"use client";

import type { TagColor } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsTextClamped } from "@/hooks/use-is-text-clamped";
import { cn } from "@/lib/utils";

import { TagChip } from "./tag-chip";

type TagNameCapsuleProps = {
  className?: string;
  color: TagColor;
  name: string;
  variant: keyof typeof TAG_NAME_FIT;
};

const TAG_NAME_FIT = {
  card: { capsule: "", name: "" },
  row: { capsule: "md:max-w-none md:shrink-0", name: "md:overflow-visible md:text-clip" },
} as const;

export function TagNameCapsule({ className, color, name, variant }: TagNameCapsuleProps) {
  const t = useTranslations("tags.item");
  const tColor = useTranslations("tags.colors");
  const { isClamped, ref } = useIsTextClamped<HTMLSpanElement>(name);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      <Tooltip onOpenChange={setIsHovered} open={isClamped && isHovered}>
        <TooltipTrigger asChild>
          <TagChip
            as="h3"
            className={cn("flex", TAG_NAME_FIT[variant].capsule, className)}
            color={color}
            name={name}
            nameClassName={TAG_NAME_FIT[variant].name}
            nameRef={ref}
          />
        </TooltipTrigger>
        <TooltipContent className="max-w-80 break-words">{name}</TooltipContent>
      </Tooltip>
      <span className="sr-only">{t("color", { color: tColor(color) })}</span>
    </>
  );
}
