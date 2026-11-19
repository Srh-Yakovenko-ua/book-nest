import type { BookLanguage } from "@app/shared";
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
import { renderWithProviders, screen, within } from "@/test-utils";

import { overviewFixture } from "../../model/statistics.fixtures";
import { LanguagesSection } from "./languages-section";

const { languages } = overviewFixture();

const languageLabels = messages.books.classification.languageLabels;

const languagesText = messages.statistics.languages;

function languageItem(language: BookLanguage, shareOfKnown: number) {
  const [first] = languages.items;
  if (first === undefined) throw new Error("fixture must expose one language row");
  return { ...first, language, shareOfKnown };
}

describe("LanguagesSection", () => {
  it("localizes the canonical enum instead of showing the api value", () => {
    renderWithProviders(<LanguagesSection languages={languages} />);

    expect(screen.getByText("Українська")).toBeInTheDocument();
    expect(screen.queryByText("ukrainian")).not.toBeInTheDocument();
    expect(screen.queryByText("uk")).not.toBeInTheDocument();
  });

  it("says the language is the edition's at the time the read was finished", () => {
    renderWithProviders(<LanguagesSection languages={languages} />);

    expect(screen.getByText(languagesText.description)).toBeInTheDocument();
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

  it("lists every one of the seven languages with the rows beyond five behind show-more", () => {
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
    expect(screen.getByRole("button", { name: "Показати ще 2" })).not.toHaveClass("lg:hidden");
    const rows = screen.getAllByRole("listitem");
    for (const row of rows.slice(0, 5)) {
      expect(row).not.toHaveClass("hidden");
    }
    for (const row of rows.slice(5)) {
      expect(row).toHaveClass("hidden");
      expect(row).not.toHaveClass("lg:flex");
    }
  });

  it("names reads with a known language as the denominator of each row's share", () => {
    renderWithProviders(<LanguagesSection languages={languages} />);

    expect(screen.getByText("66,7% відомих")).toBeInTheDocument();
  });

  it("shows no language-count tile", () => {
    renderWithProviders(<LanguagesSection languages={languages} />);

    expect(screen.queryByRole("term")).not.toBeInTheDocument();
    expect(screen.queryByText("Мов")).not.toBeInTheDocument();
  });

  it.each([
    { count: 1, text: "1 мова" },
    { count: 2, text: "2 мови" },
    { count: 5, text: "5 мов" },
  ])("counts $count language(s) in the header as $text", ({ count, text }) => {
    renderWithProviders(
      <LanguagesSection
        languages={{
          ...languages,
          items: BookLanguageSchema.options
            .slice(0, count)
            .map((language) => languageItem(language, 1 / count)),
        }}
      />,
    );

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("fills each bar to the language's share of reads with a known language", () => {
    renderWithProviders(
      <LanguagesSection
        languages={{
          ...languages,
          items: [languageItem("ukrainian", 0.75), languageItem("english", 0.25)],
        }}
      />,
    );

    const widths = within(screen.getByRole("list"))
      .getAllByRole("listitem")
      .map((row) =>
        Number.parseFloat(row.querySelector<HTMLElement>("[style*='width']")?.style.width ?? ""),
      );
    expect(widths).toEqual([75, 25]);
  });

  it("shows a lone language as one unnumbered row holding all known reads", () => {
    renderWithProviders(
      <LanguagesSection
        languages={{
          ...languages,
          items: [{ ...languageItem("ukrainian", 1), completedReadCount: 3 }],
        }}
      />,
    );

    const row = within(screen.getByRole("list")).getByRole("listitem");
    expect(row).toHaveTextContent("Українська");
    expect(row).toHaveTextContent("100% відомих");
    expect(row).toHaveTextContent("3 читання");
    expect(within(row).queryByText("1")).not.toBeInTheDocument();
    expect(screen.getByText(languagesText.description)).toBeInTheDocument();
  });

  it("numbers the rows when there are several languages", () => {
    renderWithProviders(
      <LanguagesSection
        languages={{
          ...languages,
          items: [languageItem("ukrainian", 0.75), languageItem("english", 0.25)],
        }}
      />,
    );

    const list = within(screen.getByRole("list"));
    expect(list.getByText("1")).toBeInTheDocument();
    expect(list.getByText("2")).toBeInTheDocument();
  });

  it("shows the empty state under the description, with no count, when the period has no languages", () => {
    renderWithProviders(<LanguagesSection languages={{ ...languages, items: [] }} />);

    expect(screen.getByText(languagesText.empty)).toBeInTheDocument();
    expect(screen.getByText(languagesText.description)).toBeInTheDocument();
    expect(screen.queryByText(/^\d+ мов/)).not.toBeInTheDocument();
  });

  it("opens a language row's finished reads from its localized label", () => {
    renderWithProviders(<LanguagesSection languages={languages} />);

    const trigger = screen.getByRole("button", {
      name: messages.statistics.details.subset.open.replace("{name}", "Українська"),
    });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveTextContent("Українська");
  });
});
