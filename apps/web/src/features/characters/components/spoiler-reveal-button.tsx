"use client";

import type { ReactNode } from "react";

import { UiIcon } from "@/components/icons";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";

type SpoilerRevealButtonProps = {
  accessibleName?: string;
  children: ReactNode;
  onReveal: () => void;
  revealing: boolean;
};

export function SpoilerRevealButton({
  accessibleName,
  children,
  onReveal,
  revealing,
}: SpoilerRevealButtonProps) {
  return (
    <Button
      aria-busy={revealing || undefined}
      aria-label={accessibleName}
      className="aria-busy:cursor-progress"
      onClick={revealing ? undefined : onReveal}
      size="sm"
      variant="secondary"
    >
      {revealing ? <Spinner size="sm" /> : <UiIcon name="eye" size={14} />}
      {children}
    </Button>
  );
}
