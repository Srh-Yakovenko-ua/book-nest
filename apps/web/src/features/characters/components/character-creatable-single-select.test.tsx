import type { FormEvent, RefCallback } from "react";

import "@testing-library/jest-dom/vitest";
import { BOOK_CHARACTER_UNSPECIFIED, type Nullable } from "@app/shared";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";
import { render, renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { BOOK_CHARACTER_STATUS, GENDER_CUSTOM, GENDER_OPTIONS } from "../model/character-options";
import { CharacterCreatableSingleSelect } from "./character-creatable-single-select";

type GenderChoice = { customText: string; option: (typeof GENDER_OPTIONS)[number] };

type StatusChoice = { customText: string; option: StatusOption };

type StatusOption = (typeof BOOK_CHARACTER_STATUS.options)[number];

type StatusSuggestions = { heading: string; labels: { count: number; label: string }[] };

const USED_STATUSES: StatusSuggestions = {
  heading: "Ваші статуси",
  labels: [
    { count: 3, label: "У полоні" },
    { count: 1, label: "живий" },
  ],
};

function EnglishGenderSelect({ onChange }: { onChange: (choice: GenderChoice) => void }) {
  const tGender = useTranslations("characters.gender");
  return (
    <CharacterCreatableSingleSelect
      clearTo="unknown"
      customText=""
      describedBy={undefined}
      invalid={false}
      label="Gender"
      maxLength={120}
      onChange={onChange}
      optionLabel={(option) => tGender(option)}
      options={GENDER_OPTIONS}
      sentinel={GENDER_CUSTOM}
      value="unknown"
    />
  );
}

function setupEnglishGenderSelect() {
  const onChange = vi.fn<(choice: GenderChoice) => void>();
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <EnglishGenderSelect onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return onChange;
}

function setupStatusSelect(initial: StatusChoice, suggestions?: StatusSuggestions) {
  const onChange = vi.fn<(choice: StatusChoice) => void>();
  renderWithProviders(
    <StatusSelect initial={initial} onChange={onChange} suggestions={suggestions} />,
  );
  return onChange;
}

function statusCombobox() {
  return screen.getByRole("combobox", { name: "Статус" });
}

function StatusSelect({
  describedBy,
  initial,
  inputRef,
  invalid = false,
  onBlur,
  onChange,
  suggestions,
}: {
  describedBy?: string;
  initial: StatusChoice;
  inputRef?: RefCallback<HTMLInputElement>;
  invalid?: boolean;
  onBlur?: () => void;
  onChange: (choice: StatusChoice) => void;
  suggestions?: StatusSuggestions;
}) {
  const tStatus = useTranslations("characters.status");
  const [choice, setChoice] = useState(initial);
  return (
    <CharacterCreatableSingleSelect
      clearTo={BOOK_CHARACTER_UNSPECIFIED.status}
      customText={choice.customText}
      describedBy={describedBy}
      invalid={invalid}
      label="Статус"
      maxLength={120}
      onBlur={onBlur}
      onChange={(next) => {
        setChoice(next);
        onChange(next);
      }}
      optionLabel={(option) => tStatus(option)}
      options={BOOK_CHARACTER_STATUS.options}
      ref={inputRef}
      sentinel={BOOK_CHARACTER_STATUS.custom}
      suggestions={suggestions}
      value={choice.option}
    />
  );
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe("CharacterCreatableSingleSelect options", () => {
  it("offers every standard status but not the custom sentinel", async () => {
    setupStatusSelect({ customText: "", option: "active" });

    await userEvent.click(statusCombobox());

    await screen.findByRole("listbox");
    expect(screen.queryByRole("option", { name: "Інше" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Не вказано",
      "Живий",
      "Зниклий",
      "Мертвий",
      "Невідомо",
      "Перевтілений",
    ]);
  });

  it("narrows the standard statuses to those containing the typed text", async () => {
    setupStatusSelect({ customText: "", option: "active" });

    await userEvent.type(statusCombobox(), "мер");

    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "Мертвий",
      "Створити «мер»",
    ]);
  });

  it("offers to create the typed text, trimmed, when it matches no standard status", async () => {
    setupStatusSelect({ customText: "", option: "not_specified" });

    await userEvent.type(statusCombobox(), "  У полоні ");

    expect(await screen.findByRole("option", { name: "Створити «У полоні»" })).toBeInTheDocument();
  });

  it("offers the matching standard status instead of a create option when the text differs only in case and spaces", async () => {
    setupStatusSelect({ customText: "", option: "not_specified" });

    await userEvent.type(statusCombobox(), "  ЖИВИЙ ");

    expect(await screen.findByRole("option", { name: "Живий" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Створити/ })).not.toBeInTheDocument();
  });

  it("offers no create option for whitespace-only text", async () => {
    setupStatusSelect({ customText: "", option: "active" });

    await userEvent.type(statusCombobox(), "   ");

    expect(await screen.findAllByRole("option")).toHaveLength(6);
    expect(screen.queryByRole("option", { name: /Створити/ })).not.toBeInTheDocument();
  });

  it("names the combobox and its list by the label", async () => {
    setupStatusSelect({ customText: "", option: "active" });

    await userEvent.click(screen.getByRole("combobox", { name: "Статус" }));

    expect(await screen.findByRole("listbox", { name: "Статус" })).toBeInTheDocument();
  });
});

describe("CharacterCreatableSingleSelect committing", () => {
  it("commits a clicked standard status with empty custom text and closes the list", async () => {
    const onChange = setupStatusSelect({ customText: "", option: "active" });

    await userEvent.click(statusCombobox());
    await userEvent.click(await screen.findByRole("option", { name: "Мертвий" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ customText: "", option: "dead" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("commits the trimmed typed text under the sentinel on Enter", async () => {
    const onChange = setupStatusSelect({ customText: "", option: "not_specified" });

    await userEvent.type(statusCombobox(), "  У полоні {Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ customText: "У полоні", option: "other" });
  });

  it("commits the matching standard status with empty custom text on Enter", async () => {
    const onChange = setupStatusSelect({ customText: "", option: "not_specified" });

    await userEvent.type(statusCombobox(), "  ЖИВИЙ {Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ customText: "", option: "active" });
  });

  it("replaces a standard status with a created custom one", async () => {
    const onChange = setupStatusSelect({ customText: "", option: "active" });

    await userEvent.type(statusCombobox(), "У полоні");
    await userEvent.click(await screen.findByRole("option", { name: "Створити «У полоні»" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ customText: "У полоні", option: "other" });
    expect(statusCombobox()).toHaveValue("У полоні");
  });

  it("drops the custom text when a custom status is replaced by a standard one", async () => {
    const onChange = setupStatusSelect({ customText: "Зник безвісти", option: "other" });

    await userEvent.click(statusCombobox());
    await userEvent.click(await screen.findByRole("option", { name: "Живий" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ customText: "", option: "active" });
    expect(statusCombobox()).toHaveValue("Живий");
  });

  it("moves the highlight with the arrow keys and commits the highlighted status on Enter", async () => {
    const onChange = setupStatusSelect({ customText: "", option: "not_specified" });

    await userEvent.click(statusCombobox());
    expect(await screen.findByRole("option", { name: "Не вказано" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("option", { name: "Зниклий" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByRole("option", { name: "Живий" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "Зниклий" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    await userEvent.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ customText: "", option: "active" });
  });

  it("highlights and commits the exact match over an earlier option that only contains the typed text", async () => {
    const onChange = setupEnglishGenderSelect();
    const combobox = screen.getByRole("combobox", { name: "Gender" });

    await userEvent.type(combobox, "male");

    const male = await screen.findByRole("option", { name: "Male" });
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Female",
      "Male",
    ]);
    expect(male).toHaveAttribute("aria-selected", "true");
    expect(combobox).toHaveAttribute("aria-activedescendant", male.id);
    await userEvent.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ customText: "", option: "male" });
  });
});

describe("CharacterCreatableSingleSelect reverting typed text", () => {
  it("closes the list on Escape and returns to the committed label without reporting a change", async () => {
    const onChange = setupStatusSelect({ customText: "", option: "active" });

    await userEvent.type(statusCombobox(), "У полоні");
    await screen.findByRole("option", { name: "Створити «У полоні»" });
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(statusCombobox()).toHaveValue("Живий");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes the list on Tab and returns to the committed label without reporting a change", async () => {
    const onChange = setupStatusSelect({ customText: "", option: "active" });

    await userEvent.type(statusCombobox(), "У полоні");
    await screen.findByRole("option", { name: "Створити «У полоні»" });
    await userEvent.tab();

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(statusCombobox()).toHaveValue("Живий");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the list closed when the combobox only receives focus", async () => {
    setupStatusSelect({ customText: "", option: "active" });

    await userEvent.tab();

    expect(statusCombobox()).toHaveFocus();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("CharacterCreatableSingleSelect display value", () => {
  it("shows an existing custom status as its text, not as the sentinel label", () => {
    setupStatusSelect({ customText: "Зник безвісти", option: "other" });

    expect(statusCombobox()).toHaveValue("Зник безвісти");
    expect(screen.queryByDisplayValue("Інше")).not.toBeInTheDocument();
  });

  it("shows the sentinel label when the custom text is empty", () => {
    setupStatusSelect({ customText: "", option: "other" });

    expect(statusCombobox()).toHaveValue("Інше");
  });
});

describe("CharacterCreatableSingleSelect inside a form", () => {
  it("does not submit the form when Enter creates a custom status", async () => {
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    const onChange = vi.fn<(choice: StatusChoice) => void>();
    renderWithProviders(
      <form onSubmit={onSubmit}>
        <StatusSelect initial={{ customText: "", option: "active" }} onChange={onChange} />
        <button type="submit">Надіслати</button>
      </form>,
    );

    await userEvent.type(statusCombobox(), "У полоні{Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ customText: "У полоні", option: "other" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit the form when Enter picks a standard status", async () => {
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    const onChange = vi.fn<(choice: StatusChoice) => void>();
    renderWithProviders(
      <form onSubmit={onSubmit}>
        <StatusSelect initial={{ customText: "", option: "active" }} onChange={onChange} />
        <button type="submit">Надіслати</button>
      </form>,
    );

    await userEvent.type(statusCombobox(), "Мертвий{Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ customText: "", option: "dead" });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("CharacterCreatableSingleSelect clearing", () => {
  it("commits the unspecified status with empty custom text", async () => {
    const onChange = setupStatusSelect({ customText: "Зник безвісти", option: "other" });

    await userEvent.click(screen.getByRole("button", { name: "Очистити" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ customText: "", option: "not_specified" });
    expect(statusCombobox()).toHaveValue("Не вказано");
  });

  it("offers no clear button while the status is already unspecified", () => {
    setupStatusSelect({ customText: "", option: "not_specified" });

    expect(statusCombobox()).toHaveValue("Не вказано");
    expect(screen.queryByRole("button", { name: "Очистити" })).not.toBeInTheDocument();
  });

  it("offers the clear button once text is typed over the unspecified status", async () => {
    setupStatusSelect({ customText: "", option: "not_specified" });

    await userEvent.type(statusCombobox(), "У полоні");

    expect(screen.getByRole("button", { name: "Очистити" })).toBeInTheDocument();
  });

  it("keeps the clear button out of the tab order", async () => {
    setupStatusSelect({ customText: "", option: "dead" });

    await userEvent.tab();
    expect(statusCombobox()).toHaveFocus();
    await userEvent.tab();

    expect(screen.getByRole("button", { name: "Очистити" })).not.toHaveFocus();
  });
});

describe("CharacterCreatableSingleSelect combobox state", () => {
  it("reports a closed list with no controlled list or active option", () => {
    setupStatusSelect({ customText: "", option: "active" });

    expect(statusCombobox()).toHaveAttribute("aria-expanded", "false");
    expect(statusCombobox()).not.toHaveAttribute("aria-controls");
    expect(statusCombobox()).not.toHaveAttribute("aria-activedescendant");
  });

  it("points at its list and at the highlighted option once opened", async () => {
    setupStatusSelect({ customText: "", option: "active" });

    await userEvent.click(statusCombobox());

    const listbox = await screen.findByRole("listbox");
    const highlighted = screen.getByRole("option", { name: "Живий", selected: true });
    expect(statusCombobox()).toHaveAttribute("aria-expanded", "true");
    expect(statusCombobox()).toHaveAttribute("aria-controls", listbox.id);
    expect(statusCombobox()).toHaveAttribute("aria-activedescendant", highlighted.id);
  });

  it("moves the active descendant to the option highlighted by ArrowDown", async () => {
    setupStatusSelect({ customText: "", option: "not_specified" });

    await userEvent.click(statusCombobox());
    await screen.findByRole("listbox");
    await userEvent.keyboard("{ArrowDown}");

    const highlighted = screen.getByRole("option", { name: "Живий", selected: true });
    expect(statusCombobox()).toHaveAttribute("aria-activedescendant", highlighted.id);
  });

  it("moves the active descendant back to the option highlighted by ArrowUp", async () => {
    setupStatusSelect({ customText: "", option: "not_specified" });

    await userEvent.click(statusCombobox());
    await screen.findByRole("listbox");
    await userEvent.keyboard("{ArrowDown}{ArrowUp}");

    const highlighted = screen.getByRole("option", { name: "Не вказано", selected: true });
    expect(statusCombobox()).toHaveAttribute("aria-activedescendant", highlighted.id);
  });
});

describe("CharacterCreatableSingleSelect opening", () => {
  it("opens the list on ArrowUp", async () => {
    setupStatusSelect({ customText: "", option: "active" });

    await userEvent.tab();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await userEvent.keyboard("{ArrowUp}");

    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    expect(statusCombobox()).toHaveAttribute("aria-expanded", "true");
  });

  it("highlights the current standard status as the active option", async () => {
    setupStatusSelect({ customText: "", option: "missing" });

    await userEvent.click(statusCombobox());

    const highlighted = await screen.findByRole("option", { name: "Зниклий", selected: true });
    expect(statusCombobox()).toHaveAttribute("aria-activedescendant", highlighted.id);
  });

  it("keeps the current standard status when Enter follows the opening", async () => {
    const onChange = setupStatusSelect({ customText: "", option: "missing" });

    await userEvent.click(statusCombobox());
    await screen.findByRole("listbox");
    await userEvent.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ customText: "", option: "missing" });
    expect(statusCombobox()).toHaveValue("Зниклий");
  });

  it("highlights no option and names no active option for a committed custom status", async () => {
    setupStatusSelect({ customText: "Зник безвісти", option: "other" });

    await userEvent.click(statusCombobox());

    expect(await screen.findAllByRole("option")).toHaveLength(6);
    expect(screen.queryByRole("option", { selected: true })).not.toBeInTheDocument();
    expect(statusCombobox()).not.toHaveAttribute("aria-activedescendant");
  });

  it("ignores Enter while a committed custom status has no highlighted option", async () => {
    const onChange = setupStatusSelect({ customText: "Зник безвісти", option: "other" });

    await userEvent.click(statusCombobox());
    await screen.findByRole("listbox");
    await userEvent.keyboard("{Enter}");

    expect(onChange).not.toHaveBeenCalled();
    expect(statusCombobox()).toHaveValue("Зник безвісти");
  });

  it("highlights the first status on ArrowDown from a committed custom status", async () => {
    setupStatusSelect({ customText: "Зник безвісти", option: "other" });

    await userEvent.click(statusCombobox());
    await screen.findByRole("listbox");
    await userEvent.keyboard("{ArrowDown}");

    expect(screen.getByRole("option", { selected: true })).toHaveTextContent("Не вказано");
  });

  it("highlights the last status on ArrowUp from a committed custom status", async () => {
    setupStatusSelect({ customText: "Зник безвісти", option: "other" });

    await userEvent.click(statusCombobox());
    await screen.findByRole("listbox");
    await userEvent.keyboard("{ArrowUp}");

    expect(screen.getByRole("option", { selected: true })).toHaveTextContent("Перевтілений");
  });
});

describe("CharacterCreatableSingleSelect your statuses", () => {
  it("lists your statuses with counts in a named group after the standard ones, without one that repeats a standard status", async () => {
    setupStatusSelect({ customText: "", option: "active" }, USED_STATUSES);

    await userEvent.click(statusCombobox());

    const group = await screen.findByRole("group", { name: "Ваші статуси" });
    expect(
      within(group)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["У полоні3"]);
    expect(screen.getAllByRole("option").at(-1)).toHaveAccessibleName("У полоні 3");
  });

  it("commits a clicked status of yours as the custom status with its text", async () => {
    const onChange = setupStatusSelect({ customText: "", option: "active" }, USED_STATUSES);

    await userEvent.click(statusCombobox());
    await userEvent.click(await screen.findByRole("option", { name: "У полоні 3" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      customText: "У полоні",
      option: BOOK_CHARACTER_STATUS.custom,
    });
    expect(statusCombobox()).toHaveValue("У полоні");
  });

  it("offers your status instead of a create option when typed in another case with stray spaces", async () => {
    const onChange = setupStatusSelect({ customText: "", option: "active" }, USED_STATUSES);

    await userEvent.type(statusCombobox(), "  у ПОЛОНІ ");

    expect(await screen.findByRole("option", { name: "У полоні 3" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByRole("option", { name: /Створити/ })).not.toBeInTheDocument();

    await userEvent.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      customText: "У полоні",
      option: BOOK_CHARACTER_STATUS.custom,
    });
  });

  it("highlights the committed status of yours when the list opens", async () => {
    setupStatusSelect(
      { customText: "у полоні", option: BOOK_CHARACTER_STATUS.custom },
      USED_STATUSES,
    );

    await userEvent.click(statusCombobox());

    const highlighted = await screen.findByRole("option", { name: "У полоні 3", selected: true });
    expect(statusCombobox()).toHaveAttribute("aria-activedescendant", highlighted.id);
  });

  it("moves the highlight from the last standard status into your statuses with ArrowDown", async () => {
    setupStatusSelect({ customText: "", option: "transformed" }, USED_STATUSES);

    await userEvent.click(statusCombobox());
    await screen.findByRole("listbox");
    await userEvent.keyboard("{ArrowDown}");

    expect(screen.getByRole("option", { selected: true })).toHaveAccessibleName("У полоні 3");
  });
});

describe("CharacterCreatableSingleSelect form field wiring", () => {
  it("reports a blur when focus tabs out of the combobox", async () => {
    const onBlur = vi.fn<() => void>();
    renderWithProviders(
      <StatusSelect
        initial={{ customText: "", option: "active" }}
        onBlur={onBlur}
        onChange={vi.fn()}
      />,
    );

    await userEvent.tab();
    expect(onBlur).not.toHaveBeenCalled();
    await userEvent.tab();

    expect(onBlur).toHaveBeenCalledOnce();
  });

  it("hands the combobox input to the ref callback", () => {
    const inputRef = vi.fn<(element: Nullable<HTMLInputElement>) => void>();
    renderWithProviders(
      <StatusSelect
        initial={{ customText: "", option: "active" }}
        inputRef={inputRef}
        onChange={vi.fn()}
      />,
    );

    expect(inputRef).toHaveBeenLastCalledWith(statusCombobox());
  });

  it("marks the combobox invalid and describes it with the referenced error", () => {
    renderWithProviders(
      <>
        <StatusSelect
          describedBy="status-error"
          initial={{ customText: "", option: "other" }}
          invalid
          onChange={vi.fn()}
        />
        <p id="status-error">Вкажіть свій статус</p>
      </>,
    );

    expect(statusCombobox()).toHaveAttribute("aria-invalid", "true");
    expect(statusCombobox()).toHaveAccessibleDescription("Вкажіть свій статус");
  });
});
