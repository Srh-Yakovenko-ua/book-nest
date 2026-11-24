import type { Nullable } from "@app/shared";

import type { HomePartOfDay } from "./home-calendar";

export type HomeGreetingTone = "neutral" | HomePartOfDay;

export type HomeSubtitleFacts = {
  activeBooksCount: Nullable<number>;
  hasReadToday: Nullable<boolean>;
  libraryTotal: Nullable<number>;
};

export type HomeSubtitleKey =
  "activeBooks" | "emptyLibrary" | "neutral" | "noActiveBooks" | "readToday";

type HomeGreetingUser = {
  name: string;
  nickname: Nullable<string>;
};

export function homeDisplayName(user: Nullable<HomeGreetingUser>): Nullable<string> {
  if (user === null) return null;
  const candidates = [user.nickname, user.name].map((value) => value?.trim() ?? "");
  return candidates.find((value) => value.length > 0) ?? null;
}

export function homeGreetingTone(partOfDay: Nullable<HomePartOfDay>): HomeGreetingTone {
  return partOfDay ?? "neutral";
}

export function homeSubtitleKey({
  activeBooksCount,
  hasReadToday,
  libraryTotal,
}: HomeSubtitleFacts): HomeSubtitleKey {
  if (libraryTotal === null) return "neutral";
  if (libraryTotal === 0) return "emptyLibrary";
  if (hasReadToday === null) return "neutral";
  if (hasReadToday) return "readToday";
  if (activeBooksCount === null) return "neutral";
  return activeBooksCount > 0 ? "activeBooks" : "noActiveBooks";
}
