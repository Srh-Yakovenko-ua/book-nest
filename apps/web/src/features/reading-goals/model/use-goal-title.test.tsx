import type { Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import enMessages from "@/messages/en.json";
import ukMessages from "@/messages/uk.json";

import { useGoalTitle } from "./use-goal-title";

const catalogs = { en: enMessages, uk: ukMessages };

function titleIn(
  locale: keyof typeof catalogs,
  goal: { name: Nullable<string>; targetCount: number },
): string {
  const { result } = renderHook(() => useGoalTitle(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <NextIntlClientProvider locale={locale} messages={catalogs[locale]}>
        {children}
      </NextIntlClientProvider>
    ),
  });
  return result.current(goal);
}

describe("useGoalTitle", () => {
  it.each(['Літо з «Відьмаком» і "Дюною"', "Класика до Різдва"])("uses the name %s", (name) => {
    expect(titleIn("uk", { name, targetCount: 12 })).toBe(name);
  });

  it.each([
    { expected: "Прочитати 1 книгу", targetCount: 1 },
    { expected: "Прочитати 2 книги", targetCount: 2 },
    { expected: "Прочитати 5 книг", targetCount: 5 },
    { expected: "Прочитати 21 книгу", targetCount: 21 },
  ])("falls back to $expected in uk without a name", ({ expected, targetCount }) => {
    expect(titleIn("uk", { name: null, targetCount })).toBe(expected);
  });

  it.each([
    { expected: "Read 1 book", targetCount: 1 },
    { expected: "Read 2 books", targetCount: 2 },
  ])("falls back to $expected in en without a name", ({ expected, targetCount }) => {
    expect(titleIn("en", { name: null, targetCount })).toBe(expected);
  });
});
