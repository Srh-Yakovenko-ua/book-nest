"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function ProgressInfoHint({ children, topic }: { children: ReactNode; topic: string }) {
  const t = useTranslations("statistics.progressHint");

  return (
    <Popover>
      <PopoverTrigger
        aria-label={t("label", { topic })}
        className="-my-1 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md align-middle text-muted-foreground outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:transition-colors"
      >
        <UiIcon aria-hidden name="info" size={14} />
      </PopoverTrigger>
      <PopoverContent
        aria-label={t("label", { topic })}
        className="w-72 max-w-(--radix-popover-content-available-width) gap-1.5 text-xs leading-relaxed"
        collisionPadding={16}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
