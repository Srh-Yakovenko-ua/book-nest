"use client";

import type { ReactNode } from "react";

import { Loader2 } from "lucide-react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

type RelationshipRevealButtonProps = {
  children: ReactNode;
  isPending: boolean;
  onReveal: () => void;
};

export function RelationshipRevealButton({
  children,
  isPending,
  onReveal,
}: RelationshipRevealButtonProps) {
  return (
    <Button
      aria-busy={isPending || undefined}
      className="aria-busy:cursor-progress"
      onClick={isPending ? undefined : onReveal}
      size="sm"
      type="button"
      variant="secondary"
    >
      {isPending ? (
        <Loader2 aria-hidden className="size-3.5 animate-spin" />
      ) : (
        <UiIcon name="eye" size={14} />
      )}
      {children}
    </Button>
  );
}
