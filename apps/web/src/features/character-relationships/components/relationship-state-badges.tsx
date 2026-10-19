"use client";

import type { Nullable, RelationshipBookStateStatus, SafeBookStateView } from "@app/shared";
import type { VariantProps } from "class-variance-authority";

import type { badgeVariants } from "@/components/ui/badge";

import { Badge } from "@/components/ui/badge";

import { useRelationshipLabels } from "../model/use-relationship-labels";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const STATUS_BADGE_VARIANT = {
  active: "success",
  ended: "secondary",
  hidden: "warning",
  unknown: "outline",
} as const satisfies Record<RelationshipBookStateStatus, BadgeVariant>;

type RelationshipStateBadgesProps = {
  state: Nullable<Pick<SafeBookStateView, "intensity" | "status">>;
};

export function RelationshipStateBadges({ state }: RelationshipStateBadgesProps) {
  const labels = useRelationshipLabels();
  if (state === null) return null;

  return (
    <>
      {state.status === null ? null : (
        <li>
          <Badge variant={STATUS_BADGE_VARIANT[state.status]}>{labels.status(state.status)}</Badge>
        </li>
      )}
      {state.intensity === null ? null : (
        <li>
          <Badge variant="outline">{labels.intensity(state.intensity)}</Badge>
        </li>
      )}
    </>
  );
}
