"use client";

import type { ReactNode } from "react";

import { UiIcon } from "@/components/icons";
import { Spinner } from "@/components/spinner";
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
      {isPending ? <Spinner size="sm" /> : <UiIcon name="eye" size={14} />}
      {children}
    </Button>
  );
}
