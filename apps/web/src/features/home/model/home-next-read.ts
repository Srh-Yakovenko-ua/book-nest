import type { HomeNextReadCandidate, HomeNextReadView, Nullable } from "@app/shared";

export type HomeNextReadActionLabel = "continueSeries" | "resume" | "start";

export type HomeNextReadFlow = "queueDialog" | "statusChange";

export type HomeNextReadState =
  | { candidates: readonly HomeNextReadCandidate[]; isIncomplete: boolean; kind: "candidates" }
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "incomplete" }
  | { kind: "loading" };

export function followingNextReadId({
  candidates,
  currentId,
}: {
  candidates: readonly HomeNextReadCandidate[];
  currentId: string;
}): Nullable<string> {
  if (candidates.length < 2) return null;
  const index = candidates.findIndex((candidate) => candidate.book.id === currentId);
  return candidates[(index + 1) % candidates.length]?.book.id ?? null;
}

export function homeNextReadState({
  data,
  isError,
}: {
  data: HomeNextReadView | undefined;
  isError: boolean;
}): HomeNextReadState {
  if (data === undefined) return isError ? { kind: "error" } : { kind: "loading" };

  const isIncomplete = data.unavailableSources.length > 0;
  if (data.candidates.length > 0) {
    return { candidates: data.candidates, isIncomplete, kind: "candidates" };
  }
  return isIncomplete ? { kind: "incomplete" } : { kind: "empty" };
}

export function isQueueConfirmedEmpty(data: HomeNextReadView | undefined): boolean {
  if (data === undefined || data.unavailableSources.includes("queue")) return false;
  return data.candidates.every((candidate) => candidate.source !== "queue");
}

export function nextReadActionLabel(candidate: HomeNextReadCandidate): HomeNextReadActionLabel {
  if (candidate.action === "resume") return "resume";
  return candidate.reason === "favorite_series" ? "continueSeries" : "start";
}

export function nextReadFlow(candidate: HomeNextReadCandidate): HomeNextReadFlow {
  return candidate.queue === null ? "statusChange" : "queueDialog";
}

export function selectNextReadCandidate({
  candidates,
  selectedId,
}: {
  candidates: readonly HomeNextReadCandidate[];
  selectedId: Nullable<string>;
}): Nullable<HomeNextReadCandidate> {
  return candidates.find((candidate) => candidate.book.id === selectedId) ?? candidates[0] ?? null;
}
