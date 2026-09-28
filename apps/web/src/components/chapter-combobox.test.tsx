import "@testing-library/jest-dom/vitest";
import type { BookChapterUsageView } from "@app/shared";

import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { ChapterCombobox } from "./chapter-combobox";

const CHAPTERS: BookChapterUsageView[] = [
  { chapter: "Розділ 1", count: 7 },
  { chapter: "Розділ 12", count: 3 },
  { chapter: "Пролог", count: 2 },
];

const CHAPTER_MAX = 100;

const OPTION_NAMES = {
  chapterOne: "Розділ 1 7",
  chapterTwelve: "Розділ 12 3",
  prologue: "Пролог 2",
};

function Harness({
  onChange,
  options,
}: {
  onChange: (value: string) => void;
  options: BookChapterUsageView[];
}) {
  const [value, setValue] = useState("");

  return (
    <ChapterCombobox
      id="chapter"
      invalid={false}
      maxLength={CHAPTER_MAX}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      options={options}
      placeholder="Напр. Розділ 12"
      value={value}
    />
  );
}

function lastChange(onChange: ReturnType<typeof vi.fn>): unknown {
  return onChange.mock.calls.at(-1)?.[0];
}

function renderCombobox(options: BookChapterUsageView[] = CHAPTERS) {
  const onChange = vi.fn();
  renderWithProviders(<Harness onChange={onChange} options={options} />);
  return { field: screen.getByPlaceholderText("Напр. Розділ 12"), onChange };
}

function renderComboboxInForm() {
  const onChange = vi.fn();
  const onSubmit = vi.fn();
  renderWithProviders(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Harness onChange={onChange} options={CHAPTERS} />
      <button type="submit">Зберегти</button>
    </form>,
  );
  return { field: screen.getByPlaceholderText("Напр. Розділ 12"), onChange, onSubmit };
}

describe("ChapterCombobox", () => {
  it("offers every chapter with its usage count once the empty field is focused", async () => {
    const { field } = renderCombobox();

    await userEvent.click(field);

    expect(
      await screen.findByRole("option", { name: OPTION_NAMES.chapterOne }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: OPTION_NAMES.chapterTwelve })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: OPTION_NAMES.prologue })).toBeInTheDocument();
  });

  it("filters case-insensitively on any part of the chapter", async () => {
    const { field } = renderCombobox();

    await userEvent.type(field, "розділ 1");

    expect(
      await screen.findByRole("option", { name: OPTION_NAMES.chapterOne }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: OPTION_NAMES.chapterTwelve })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: OPTION_NAMES.prologue })).not.toBeInTheDocument();
  });

  it("emits the stored spelling when a suggestion is picked", async () => {
    const { field, onChange } = renderCombobox();

    await userEvent.type(field, "розділ 1");
    await userEvent.click(await screen.findByRole("option", { name: OPTION_NAMES.chapterOne }));

    expect(lastChange(onChange)).toBe("Розділ 1");
    expect(field).toHaveValue("Розділ 1");
  });

  it("keeps free text that matches no chapter and closes the list", async () => {
    const { field, onChange } = renderCombobox();

    await userEvent.type(field, "Епілог");

    expect(lastChange(onChange)).toBe("Епілог");
    expect(field).toHaveValue("Епілог");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("stays a plain text field when the book has no chapters yet", async () => {
    const { field, onChange } = renderCombobox([]);

    await userEvent.click(field);
    await userEvent.type(field, "Розділ 1");

    expect(lastChange(onChange)).toBe("Розділ 1");
    expect(field).toHaveValue("Розділ 1");
    expect(field).not.toHaveAttribute("role", "combobox");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("keeps the typed text when Enter arrives without a keyboard highlight", async () => {
    const { field, onChange } = renderComboboxInForm();

    await userEvent.type(field, "розділ 1");
    await screen.findByRole("option", { name: OPTION_NAMES.chapterOne });
    await userEvent.keyboard("{Enter}");

    expect(lastChange(onChange)).toBe("розділ 1");
    expect(field).toHaveValue("розділ 1");
  });

  it("submits the surrounding form on Enter while the suggestions are open", async () => {
    const { field, onSubmit } = renderComboboxInForm();

    await userEvent.type(field, "розділ 1");
    await screen.findByRole("option", { name: OPTION_NAMES.chapterOne });
    await userEvent.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("emits the stored spelling when Enter follows a keyboard highlight", async () => {
    const { field, onChange } = renderComboboxInForm();

    await userEvent.type(field, "розділ 1");
    await screen.findByRole("option", { name: OPTION_NAMES.chapterOne });
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");

    expect(lastChange(onChange)).toBe("Розділ 12");
    expect(field).toHaveValue("Розділ 12");
  });

  it("returns to free text when the user types after moving the highlight", async () => {
    const { field, onChange, onSubmit } = renderComboboxInForm();

    await userEvent.type(field, "розділ 1");
    await screen.findByRole("option", { name: OPTION_NAMES.chapterOne });
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.type(field, "2");
    await screen.findByRole("option", { name: OPTION_NAMES.chapterTwelve });
    await userEvent.keyboard("{Enter}");

    expect(lastChange(onChange)).toBe("розділ 12");
    expect(field).toHaveValue("розділ 12");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("disarms the highlight when the closed suggestions are reopened", async () => {
    const { field, onChange } = renderComboboxInForm();

    await userEvent.type(field, "розділ 1");
    await screen.findByRole("option", { name: OPTION_NAMES.chapterOne });
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(field);
    await screen.findByRole("option", { name: OPTION_NAMES.chapterOne });
    await userEvent.keyboard("{Enter}");

    expect(lastChange(onChange)).toBe("розділ 1");
    expect(field).toHaveValue("розділ 1");
  });

  it("caps the typed chapter at the given length", () => {
    const { field } = renderCombobox();

    expect(field).toHaveAttribute("maxlength", String(CHAPTER_MAX));
  });
});
