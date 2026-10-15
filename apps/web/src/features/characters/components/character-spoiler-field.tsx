"use client";

import type { CharacterRevealFieldKey } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { REVEAL_FOCUS_TARGET, revealFocusTarget } from "../model/character-spoiler";
import { SpoilerRevealButton } from "./spoiler-reveal-button";

type CharacterSpoilerFieldProps = {
  children: ReactNode;
  hidden: boolean;
  label: string;
  reveal?: SpoilerFieldReveal;
};

type SpoilerFieldReveal = {
  field: CharacterRevealFieldKey;
  onReveal: () => void;
  pending: boolean;
};

export function CharacterSpoilerField({
  children,
  hidden,
  label,
  reveal,
}: CharacterSpoilerFieldProps) {
  const t = useTranslations("characters.spoiler");
  const labelId = useId();

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        reveal === undefined ? null : ["rounded-lg", REVEAL_FOCUS_TARGET.focusClassName],
      )}
      {...(reveal === undefined
        ? {}
        : { "aria-labelledby": labelId, role: "group", ...revealFocusTarget(reveal.field) })}
    >
      <span
        className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
        id={labelId}
      >
        {label}
      </span>
      {hidden ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-secondary/50 px-3 py-2.5">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <UiIcon name="lock" size={16} />
            {t("hidden")}
          </span>
          {reveal === undefined ? null : (
            <SpoilerRevealButton
              accessibleName={t("revealAria", { field: label })}
              onReveal={reveal.onReveal}
              revealing={reveal.pending}
            >
              {t("reveal")}
            </SpoilerRevealButton>
          )}
        </div>
      ) : (
        <div className="text-sm leading-relaxed text-foreground">{children}</div>
      )}
    </div>
  );
}
