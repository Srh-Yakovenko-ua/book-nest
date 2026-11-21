import type { LucideIcon } from "lucide-react";

import {
  Castle,
  EyeOff,
  GraduationCap,
  Handshake,
  Heart,
  Layers,
  Sparkles,
  Swords,
  Tag,
  Users,
} from "lucide-react";

import type { GraphPairTone } from "../../model/workspace/graph-person-semantics";

type GraphPersonToneStyle = {
  arrow: string;
  chip: string;
  dash: string | undefined;
  icon: LucideIcon;
  iconColor: string;
  line: string;
};

export const GRAPH_PERSON_TONES = {
  conflict: {
    arrow: "fill-relation-conflict",
    chip: "border-relation-conflict/35 bg-relation-conflict/10",
    dash: "7 5",
    icon: Swords,
    iconColor: "text-relation-conflict",
    line: "stroke-relation-conflict",
  },
  custom: {
    arrow: "fill-relation-custom",
    chip: "border-relation-custom/35 bg-relation-custom/10",
    dash: "9 4 2 4",
    icon: Tag,
    iconColor: "text-relation-custom",
    line: "stroke-relation-custom",
  },
  family: {
    arrow: "fill-relation-family",
    chip: "border-relation-family/35 bg-relation-family/10",
    dash: undefined,
    icon: Users,
    iconColor: "text-relation-family",
    line: "stroke-relation-family",
  },
  hierarchy: {
    arrow: "fill-relation-hierarchy",
    chip: "border-relation-hierarchy/35 bg-relation-hierarchy/10",
    dash: "14 5",
    icon: Castle,
    iconColor: "text-relation-hierarchy",
    line: "stroke-relation-hierarchy",
  },
  masked: {
    arrow: "fill-relation-neutral",
    chip: "border-border bg-muted",
    dash: "3 6",
    icon: EyeOff,
    iconColor: "text-muted-foreground",
    line: "stroke-relation-neutral",
  },
  mentorship: {
    arrow: "fill-relation-mentorship",
    chip: "border-relation-mentorship/35 bg-relation-mentorship/10",
    dash: undefined,
    icon: GraduationCap,
    iconColor: "text-relation-mentorship",
    line: "stroke-relation-mentorship",
  },
  mixed: {
    arrow: "fill-relation-neutral",
    chip: "border-border bg-muted",
    dash: undefined,
    icon: Layers,
    iconColor: "text-muted-foreground",
    line: "stroke-relation-neutral",
  },
  romantic: {
    arrow: "fill-relation-romantic",
    chip: "border-relation-romantic/35 bg-relation-romantic/10",
    dash: undefined,
    icon: Heart,
    iconColor: "text-relation-romantic",
    line: "stroke-relation-romantic",
  },
  social: {
    arrow: "fill-relation-social",
    chip: "border-relation-social/40 bg-relation-social/12",
    dash: undefined,
    icon: Handshake,
    iconColor: "text-relation-social",
    line: "stroke-relation-social",
  },
  supernatural: {
    arrow: "fill-relation-supernatural",
    chip: "border-relation-supernatural/35 bg-relation-supernatural/10",
    dash: "2 5",
    icon: Sparkles,
    iconColor: "text-relation-supernatural",
    line: "stroke-relation-supernatural",
  },
} as const satisfies Record<GraphPairTone, GraphPersonToneStyle>;
