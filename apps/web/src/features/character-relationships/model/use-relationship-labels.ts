"use client";

import type {
  Nullable,
  RelationshipBookStateStatus,
  RelationshipCategory,
  RelationshipDirectionality,
  RelationshipIntensity,
  RelationshipType,
  SafeBookStateView,
  SafeRelationshipEdgeView,
} from "@app/shared";

import { useTranslations } from "next-intl";

import { formatAudioPosition } from "./relationship-audio-position";

const RELATIONSHIP_POSITION_FORMAT = {
  partSeparator: ", ",
} as const;

type RelationshipPosition = {
  audioSeconds: Nullable<number>;
  chapter: Nullable<string>;
  page: Nullable<number>;
};

type RelationshipPositionEdge = "ended" | "introduced";

export function useRelationshipLabels() {
  const t = useTranslations("relationships");

  function position(value: RelationshipPosition): Nullable<string> {
    const parts = [
      value.chapter === null ? null : t("position.chapter", { chapter: value.chapter }),
      value.page === null ? null : t("position.page", { page: value.page }),
      value.audioSeconds === null
        ? null
        : t("position.audio", { time: formatAudioPosition(value.audioSeconds) }),
    ].flatMap((part) => (part === null ? [] : [part]));
    return parts.length === 0 ? null : parts.join(RELATIONSHIP_POSITION_FORMAT.partSeparator);
  }

  return {
    category: (category: RelationshipCategory) => t(`categories.${category}`),
    directionality: (directionality: Nullable<RelationshipDirectionality>) =>
      t(`directionality.${directionality ?? "hidden"}`),
    edgeType: ({
      customType,
      type,
    }: Pick<SafeRelationshipEdgeView, "customType" | "type">): Nullable<string> => {
      if (type === null) return null;
      if (type !== "custom") return t(`types.${type}`);
      const customLabel = customType?.trim() ?? "";
      return customLabel === "" ? t("types.custom") : customLabel;
    },
    intensity: (intensity: RelationshipIntensity) => t(`intensities.${intensity}`),
    statePosition: ({
      edge,
      state,
    }: {
      edge: RelationshipPositionEdge;
      state: SafeBookStateView;
    }) => position(toStatePosition({ edge, state })),
    status: (status: RelationshipBookStateStatus) => t(`statuses.${status}`),
    type: (type: RelationshipType) => t(`types.${type}`),
  };
}

function toStatePosition({
  edge,
  state,
}: {
  edge: RelationshipPositionEdge;
  state: SafeBookStateView;
}): RelationshipPosition {
  return edge === "introduced"
    ? {
        audioSeconds: state.introducedAudioSeconds,
        chapter: state.introducedChapter,
        page: state.introducedPage,
      }
    : { audioSeconds: state.endedAudioSeconds, chapter: state.endedChapter, page: state.endedPage };
}
