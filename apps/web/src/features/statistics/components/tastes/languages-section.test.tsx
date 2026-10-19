import type { ReactNode } from "react";

import { BookLanguageSchema } from "@app/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import messages from "@/messages/uk.json";
import { renderWithProviders, screen } from "@/test-utils";

import { overviewFixture } from "../../model/statistics.fixtures";
import { LanguagesSection } from "./languages-section";

const { languages } = overviewFixture();

const languageLabels = messages.books.classification.languageLabels;

const languagesText = messages.statistics.languages;

const SHARE_NOTE = "Частки рахуються серед читань із відомою мовою.";

describe("LanguagesSection", () => {
  it("localizes the canonical enum instead of showing the api value", () => {
    renderWithProviders(<LanguagesSection languages={languages} />);

    expect(screen.getByText("Українська")).toBeInTheDocument();
    expect(screen.queryByText("ukrainian")).not.toBeInTheDocument();
    expect(screen.queryByText("uk")).not.toBeInTheDocument();
  });

  it("says where the language came from", () => {
    renderWithProviders(<LanguagesSection languages={languages} />);

    expect(
      screen.getByText("Мова видання, зафіксована в BookNest на момент завершення читання."),
    ).toBeInTheDocument();
  });

  it("shows coverage rather than an unknown ranking row", () => {
    renderWithProviders(
      <LanguagesSection
        languages={{
          ...languages,
          availability: "partial",
          coverage: { eligibleCount: 37, knownCount: 20, percent: 0.54 },
        }}
      />,
    );

    expect(
      screen.getByText("20 із 37 історичних читань мають надійно збережену мову видання"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Не вказано")).not.toBeInTheDocument();
  });

  it("says the metric could not be measured rather than showing an empty ranking", () => {
    renderWithProviders(
      <LanguagesSection
        languages={{
          ...languages,
          availability: "unavailable",
          coverage: { eligibleCount: 12, knownCount: 0, percent: 0 },
          items: [],
        }}
      />,
    );

    expect(screen.getByText("Мов виміряти не вдалося")).toBeInTheDocument();
    expect(
      screen.queryByText("У завершених читаннях періоду немає збереженої мови."),
    ).not.toBeInTheDocument();
  });

  it("keeps the backend ranking order", () => {
    const [first] = languages.items;
    if (first === undefined) throw new Error("fixture must expose one language row");

    renderWithProviders(
      <LanguagesSection
        languages={{
          ...languages,
          items: [
            { ...first, completedReadCount: 2, language: "ukrainian" },
            { ...first, completedReadCount: 2, language: "english" },
          ],
        }}
      />,
    );

    const rows = screen.getAllByText(/Українська|Англійська/);

    expect(rows[0]?.textContent).toBe("Українська");
    expect(rows[1]?.textContent).toBe("Англійська");
  });

  it("lists every one of the seven languages with the rows beyond three behind show-more", () => {
    const [first] = languages.items;
    if (first === undefined) throw new Error("fixture must expose one language row");

    renderWithProviders(
      <LanguagesSection
        languages={{
          ...languages,
          items: BookLanguageSchema.options.map((language, index) => ({
            ...first,
            completedReadCount: 7 - index,
            language,
            shareOfKnown: (7 - index) / 28,
          })),
        }}
      />,
    );

    for (const language of BookLanguageSchema.options) {
      expect(screen.getByText(languageLabels[language])).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Показати ще 4" })).toBeInTheDocument();
  });

  it("says shares are counted among reads with a known language in a note, not in the KPI", () => {
    renderWithProviders(<LanguagesSection languages={languages} />);

    expect(screen.getByText(SHARE_NOTE)).toBeInTheDocument();
    expect(screen.getByRole("term")).toHaveTextContent(languagesText.countLabel);
    for (const definition of screen.getAllByRole("definition")) {
      expect(definition).not.toHaveTextContent(SHARE_NOTE);
    }
    expect(screen.getByText("66,7% відомих")).toBeInTheDocument();
  });

  it("drops the share note when the period has no languages", () => {
    renderWithProviders(<LanguagesSection languages={{ ...languages, items: [] }} />);

    expect(screen.getByText(languagesText.empty)).toBeInTheDocument();
    expect(screen.getByText(languagesText.sourceHint)).toBeInTheDocument();
    expect(screen.queryByText(SHARE_NOTE)).not.toBeInTheDocument();
  });
});
