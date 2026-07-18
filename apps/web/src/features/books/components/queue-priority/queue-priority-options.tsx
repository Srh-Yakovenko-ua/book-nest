"use client";

import type { QueuePriority } from "@app/shared";

import { useTranslations } from "next-intl";
import { type KeyboardEvent, useId } from "react";

import { QUEUE_PRIORITY_META, QUEUE_PRIORITY_ORDER } from "../../model/queue-priority";
import { QueuePriorityOptionCard } from "./queue-priority-option-card";

type QueuePriorityOptionsProps = {
  activeValue: QueuePriority;
  onSelect: (value: QueuePriority) => void;
};

const NEXT_KEYS = new Set(["ArrowDown", "ArrowRight"]);
const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

export function QueuePriorityOptions({ activeValue, onSelect }: QueuePriorityOptionsProps) {
  const t = useTranslations("books.organization.priority");
  const groupId = useId();

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!NEXT_KEYS.has(event.key) && !PREV_KEYS.has(event.key)) return;
    event.preventDefault();
    const delta = NEXT_KEYS.has(event.key) ? 1 : -1;
    const next =
      QUEUE_PRIORITY_ORDER[
        (index + delta + QUEUE_PRIORITY_ORDER.length) % QUEUE_PRIORITY_ORDER.length
      ];
    if (next === undefined) return;
    onSelect(next);
    const node = document.getElementById(`${groupId}-${next}`);
    if (node instanceof HTMLElement) node.focus();
  }

  return (
    <div aria-label={t("title")} className="grid gap-3 sm:grid-cols-3" role="radiogroup">
      {QUEUE_PRIORITY_ORDER.map((value, index) => {
        const meta = QUEUE_PRIORITY_META[value];
        const active = value === activeValue;
        return (
          <QueuePriorityOptionCard
            active={active}
            description={t(`${value}.shortDescription`)}
            icon={meta.icon}
            id={`${groupId}-${value}`}
            key={value}
            label={t(`${value}.label`)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onSelect={() => onSelect(value)}
            tabIndex={active ? 0 : -1}
            tone={meta.tone}
          />
        );
      })}
    </div>
  );
}
