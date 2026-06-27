import type { MediaView } from "@app/shared";

export type CoverState =
  | { file: File; kind: "selected"; previewUrl: string }
  | { kind: "empty" }
  | { kind: "existing"; media: MediaView }
  | { kind: "removed" };

export function coverFullSrc(state: CoverState): string | undefined {
  if (state.kind === "selected") return state.previewUrl;
  if (state.kind === "existing") return state.media.urls.full;
  return undefined;
}

export function coverPreviewSrc(state: CoverState): string | undefined {
  if (state.kind === "selected") return state.previewUrl;
  if (state.kind === "existing") return state.media.urls.card;
  return undefined;
}
