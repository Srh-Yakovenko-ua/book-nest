"use client";

import { UiIcon } from "@/components/icons";

import { SpoilerRevealButton } from "./spoiler-reveal-button";

type CharacterHiddenGroupNoticeProps = {
  accessibleName?: string;
  actionLabel: string;
  message: string;
  onReveal: () => void;
  revealing: boolean;
};

export function CharacterHiddenGroupNotice({
  accessibleName,
  actionLabel,
  message,
  onReveal,
  revealing,
}: CharacterHiddenGroupNoticeProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-secondary/50 px-3 py-2.5">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <UiIcon name="lock" size={16} />
        {message}
      </span>
      <SpoilerRevealButton
        accessibleName={accessibleName}
        onReveal={onReveal}
        revealing={revealing}
      >
        {actionLabel}
      </SpoilerRevealButton>
    </div>
  );
}
