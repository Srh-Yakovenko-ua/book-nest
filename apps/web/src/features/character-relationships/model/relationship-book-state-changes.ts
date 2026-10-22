import type { Nullable } from "@app/shared";

import type { RelationshipBookStateFormInput } from "./relationship-form-schema";

import { parseAudioPosition } from "./relationship-audio-position";
import { relationshipBookStateDefaults } from "./relationship-form-input";

type EffectiveBookState = Record<keyof RelationshipBookStateFormInput, EffectiveBookStateValue>;

type EffectiveBookStateValue = Nullable<boolean | number | string>;

export function bookStateChangedFromDefaults(current: RelationshipBookStateFormInput): boolean {
  const defaults = Object.values(toEffectiveBookState(relationshipBookStateDefaults(null)));
  return Object.values(toEffectiveBookState(current)).some(
    (value, index) => !Object.is(value, defaults[index]),
  );
}

function toEffectiveAudio(value: string): Nullable<number | string> {
  const text = value.trim();
  if (text === "") return null;
  return parseAudioPosition(text) ?? text;
}

function toEffectiveBookState(state: RelationshipBookStateFormInput): EffectiveBookState {
  return {
    description: toEffectiveText(state.description),
    endedAudio: toEffectiveAudio(state.endedAudio),
    endedChapter: toEffectiveText(state.endedChapter),
    endedPage: state.endedPage,
    hideRelationshipAsSpoiler: state.hideRelationshipAsSpoiler,
    intensity: state.intensity,
    introducedAudio: toEffectiveAudio(state.introducedAudio),
    introducedChapter: toEffectiveText(state.introducedChapter),
    introducedPage: state.introducedPage,
    isDescriptionSpoiler: state.isDescriptionSpoiler,
    isTypeSpoiler: state.isTypeSpoiler,
    status: state.status,
  };
}

function toEffectiveText(value: string): Nullable<string> {
  const text = value.trim();
  return text === "" ? null : text;
}
