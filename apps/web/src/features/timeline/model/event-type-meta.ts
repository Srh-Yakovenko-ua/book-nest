import type { TimelineEventType } from "@app/shared";

import type { UiIconName } from "@/components/icons";

type EventTypeMeta = {
  icon: UiIconName;
  labelKey: string;
};

export const EVENT_TYPE_META = {
  battle: { icon: "flame", labelKey: "eventType.battle" },
  betrayal: { icon: "alert-triangle", labelKey: "eventType.betrayal" },
  character_appearance: { icon: "user", labelKey: "eventType.character_appearance" },
  conflict: { icon: "target", labelKey: "eventType.conflict" },
  conversation: { icon: "quote", labelKey: "eventType.conversation" },
  death: { icon: "x-circle", labelKey: "eventType.death" },
  magic: { icon: "sparkles", labelKey: "eventType.magic" },
  main: { icon: "star", labelKey: "eventType.main" },
  mystery: { icon: "eye", labelKey: "eventType.mystery" },
  other: { icon: "circle-slash", labelKey: "eventType.other" },
  politics: { icon: "building", labelKey: "eventType.politics" },
  romance: { icon: "heart", labelKey: "eventType.romance" },
  travel: { icon: "globe", labelKey: "eventType.travel" },
  twist: { icon: "swap", labelKey: "eventType.twist" },
} as const satisfies Record<TimelineEventType, EventTypeMeta>;

export function eventTypeMeta(type: TimelineEventType) {
  return EVENT_TYPE_META[type];
}
