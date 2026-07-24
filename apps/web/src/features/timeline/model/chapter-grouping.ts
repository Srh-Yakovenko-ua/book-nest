import type { Nullable, TimelineEventView } from "@app/shared";

export type ChapterGroup = {
  chapter: Nullable<string>;
  events: TimelineEventView[];
  key: string;
};

export function groupEventsByChapter(events: readonly TimelineEventView[]): ChapterGroup[] {
  const groups: ChapterGroup[] = [];
  const byKey = new Map<string, ChapterGroup>();

  for (const event of events) {
    const trimmed = event.chapter?.trim() ?? "";
    const chapter = trimmed.length === 0 ? null : trimmed;
    const key = chapter ?? "";
    const existing = byKey.get(key);
    if (existing === undefined) {
      const group: ChapterGroup = { chapter, events: [event], key };
      byKey.set(key, group);
      groups.push(group);
    } else {
      existing.events.push(event);
    }
  }

  return groups;
}
