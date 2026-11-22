import type { FamilyTreeLineageKind } from "@app/shared";
import type { LucideIcon } from "lucide-react";

import {
  GitFork,
  GitMerge,
  Heart,
  HeartCrack,
  ShieldHalf,
  TriangleAlert,
  Users,
} from "lucide-react";

import type { TreePairStyle } from "../../model/workspace/graph-tree-pairs";

type GraphTreeToneStyle = {
  badge: string;
  dash: string | undefined;
  icon: LucideIcon;
  iconColor: string;
  line: string;
};

export const GRAPH_TREE_TONES = {
  conflict: {
    badge: "border-relation-conflict/40 bg-card",
    dash: "6 4",
    icon: TriangleAlert,
    iconColor: "text-relation-conflict",
    line: "stroke-relation-conflict",
  },
  distant: {
    badge: "border-relation-neutral/40 bg-card",
    dash: "2 5",
    icon: GitFork,
    iconColor: "text-muted-foreground",
    line: "stroke-relation-neutral",
  },
  exUnions: {
    badge: "border-relation-romantic/35 bg-card",
    dash: "12 3 2 3",
    icon: HeartCrack,
    iconColor: "text-relation-romantic",
    line: "stroke-relation-romantic",
  },
  guardians: {
    badge: "border-relation-supernatural/40 bg-card",
    dash: "8 4",
    icon: ShieldHalf,
    iconColor: "text-relation-supernatural",
    line: "stroke-relation-supernatural",
  },
  lineage: {
    badge: "border-icon/35 bg-card",
    dash: undefined,
    icon: GitMerge,
    iconColor: "text-icon",
    line: "stroke-icon",
  },
  marriages: {
    badge: "border-relation-romantic/35 bg-card",
    dash: undefined,
    icon: Heart,
    iconColor: "text-relation-romantic",
    line: "stroke-relation-romantic",
  },
  siblings: {
    badge: "border-relation-mentorship/35 bg-card",
    dash: "4 3",
    icon: Users,
    iconColor: "text-relation-mentorship",
    line: "stroke-relation-mentorship",
  },
} as const satisfies Record<TreePairStyle, GraphTreeToneStyle>;

export const GRAPH_TREE_LINEAGE_DASH = {
  adoptive: "10 5",
  biological: undefined,
  step: "2 4",
} as const satisfies Record<FamilyTreeLineageKind, string | undefined>;
