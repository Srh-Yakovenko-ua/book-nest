"use client";

import type { AddToReadingQueueInput, ReadingQueuePlacement } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

type AddToQueueForm = {
  buildInput: (bookId: string) => AddToReadingQueueInput | null;
  error: string | undefined;
  placement: ReadingQueuePlacement;
  position: string;
  reset: () => void;
  setPlacement: (placement: ReadingQueuePlacement) => void;
  setPosition: (value: string) => void;
};

type PositionMessages = {
  integer: string;
  max: string;
  number: string;
  positive: string;
  required: string;
};

export function useAddToQueueForm(queueLength: number): AddToQueueForm {
  const t = useTranslations("readingQueue.position.errors");
  const [placement, setPlacement] = useState<ReadingQueuePlacement>("end");
  const [position, setPosition] = useState(() => String(queueLength + 1));

  const messages: PositionMessages = {
    integer: t("integer"),
    max: t("max"),
    number: t("number"),
    positive: t("positive"),
    required: t("required"),
  };
  const error = resolvePositionError({ messages, placement, position, queueLength });

  function buildInput(bookId: string): AddToReadingQueueInput | null {
    if (placement !== "specific") return { bookId, placement };
    if (queueLength === 0) return { bookId, placement, position: 1 };
    if (error !== undefined) return null;
    return { bookId, placement, position: Number(position.trim()) };
  }

  function reset() {
    setPlacement("end");
    setPosition(String(queueLength + 1));
  }

  return { buildInput, error, placement, position, reset, setPlacement, setPosition };
}

function resolvePositionError({
  messages,
  placement,
  position,
  queueLength,
}: {
  messages: PositionMessages;
  placement: ReadingQueuePlacement;
  position: string;
  queueLength: number;
}): string | undefined {
  if (placement !== "specific" || queueLength === 0) return undefined;

  const raw = position.trim();
  if (raw === "") return messages.required;

  const parsed = Number(raw);
  if (Number.isNaN(parsed)) return messages.number;
  if (!Number.isInteger(parsed)) return messages.integer;
  if (parsed <= 0) return messages.positive;
  if (parsed > queueLength + 1) return messages.max;

  return undefined;
}
