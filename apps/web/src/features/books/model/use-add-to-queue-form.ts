"use client";

import type { AddToReadingQueueInput } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type {
  QueueAddChoice,
  QueueMode,
  QueueMoveChoice,
  QueueOutcome,
  QueuePickerItem,
  QueuePlacementChoice,
  QueueRelativeSide,
} from "./queue-placement";

import { buildAddInput, buildMoveOrder, maxQueuePosition } from "./queue-placement";

type AddToQueueForm = {
  buildInput: (bookId: string) => AddToReadingQueueInput | null;
  buildOrder: () => null | string[];
  error: string | undefined;
  isValid: boolean;
  maxPosition: number;
  mode: QueueMode;
  outcome: null | QueueOutcome;
  placement: QueuePlacementChoice;
  position: string;
  queueLength: number;
  relativeBookId: null | string;
  relativeCandidates: QueuePickerItem[];
  relativeSide: QueueRelativeSide;
  reset: () => void;
  setPlacement: (placement: QueuePlacementChoice) => void;
  setPosition: (value: string) => void;
  setRelativeBookId: (bookId: null | string) => void;
  setRelativeSide: (side: QueueRelativeSide) => void;
};

type PositionMessages = {
  integer: string;
  max: string;
  number: string;
  positive: string;
  required: string;
};

type UseAddToQueueFormParams = {
  currentBookId?: string;
  queueItems: QueuePickerItem[];
};

export function useAddToQueueForm({
  currentBookId,
  queueItems,
}: UseAddToQueueFormParams): AddToQueueForm {
  const t = useTranslations("readingQueue.position.errors");
  const [placement, setPlacement] = useState<QueuePlacementChoice>("end");
  const [position, setPosition] = useState("");
  const [relativeBookId, setRelativeBookId] = useState<null | string>(null);
  const [relativeSide, setRelativeSide] = useState<QueueRelativeSide>("after");

  const items = [...queueItems].sort((left, right) => left.position - right.position);
  const orderedBookIds = items.map((item) => item.id);
  const queueLength = items.length;
  const mode: QueueMode =
    currentBookId !== undefined && items.some((item) => item.id === currentBookId) ? "move" : "add";
  const maxPosition = maxQueuePosition({ mode, queueLength });
  const relativeCandidates =
    mode === "move" ? items.filter((item) => item.id !== currentBookId) : items;

  const messages: PositionMessages = {
    integer: t("integer"),
    max: t("max"),
    number: t("number"),
    positive: t("positive"),
    required: t("required"),
  };
  const error = resolvePositionError({ maxPosition, messages, placement, position, queueLength });

  const relativeTarget = relativeCandidates.find((item) => item.id === relativeBookId);
  const outcome = resolveOutcome();
  const isValid = outcome !== null;

  function resolveOutcome(): null | QueueOutcome {
    if (queueLength === 0 || placement === "start") return { kind: "first" };
    if (placement === "end") return { kind: "end", position: maxPosition };
    if (placement === "specific") {
      if (error !== undefined) return null;
      return { kind: "specific", position: Number(position.trim()) };
    }
    if (relativeTarget === undefined) return null;
    if (mode === "add") {
      const targetPosition =
        relativeSide === "before" ? relativeTarget.position : relativeTarget.position + 1;
      return {
        kind: "relative",
        position: targetPosition,
        side: relativeSide,
        title: relativeTarget.title,
      };
    }
    if (currentBookId === undefined) return null;
    const order = buildMoveOrder({
      choice: { placement: "relative", relativeBookId: relativeTarget.id, side: relativeSide },
      currentBookId,
      orderedBookIds,
    });
    if (order === null) return null;
    return {
      kind: "relative",
      position: order.indexOf(currentBookId) + 1,
      side: relativeSide,
      title: relativeTarget.title,
    };
  }

  function toAddChoice(): null | QueueAddChoice {
    if (placement === "start") return { placement: "start" };
    if (placement === "end") return { placement: "end" };
    if (placement === "specific") {
      if (error !== undefined) return null;
      return { placement: "specific", position: Number(position.trim()) };
    }
    if (relativeTarget === undefined) return null;
    return { placement: "relative", relativePosition: relativeTarget.position, side: relativeSide };
  }

  function toMoveChoice(): null | QueueMoveChoice {
    if (placement === "start") return { placement: "start" };
    if (placement === "end") return { placement: "end" };
    if (placement === "specific") {
      if (error !== undefined) return null;
      return { placement: "specific", position: Number(position.trim()) };
    }
    if (relativeTarget === undefined) return null;
    return { placement: "relative", relativeBookId: relativeTarget.id, side: relativeSide };
  }

  function buildInput(bookId: string): AddToReadingQueueInput | null {
    if (queueLength === 0) return { bookId, placement: "specific", position: 1 };
    const choice = toAddChoice();
    if (choice === null) return null;
    return buildAddInput({ bookId, choice, queueLength });
  }

  function buildOrder(): null | string[] {
    if (currentBookId === undefined) return null;
    const choice = toMoveChoice();
    if (choice === null) return null;
    return buildMoveOrder({ choice, currentBookId, orderedBookIds });
  }

  function reset() {
    setPlacement("end");
    setPosition("");
    setRelativeBookId(null);
    setRelativeSide("after");
  }

  return {
    buildInput,
    buildOrder,
    error,
    isValid,
    maxPosition,
    mode,
    outcome,
    placement,
    position,
    queueLength,
    relativeBookId,
    relativeCandidates,
    relativeSide,
    reset,
    setPlacement,
    setPosition,
    setRelativeBookId,
    setRelativeSide,
  };
}

function resolvePositionError({
  maxPosition,
  messages,
  placement,
  position,
  queueLength,
}: {
  maxPosition: number;
  messages: PositionMessages;
  placement: QueuePlacementChoice;
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
  if (parsed > maxPosition) return messages.max;

  return undefined;
}
