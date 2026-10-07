import type { ComponentProps, FormEvent } from "react";

import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { CharacterRolePicker } from "./character-role-picker";

type RoleRow = ComponentProps<typeof CharacterRolePicker>["value"][number];

function customRole(name: string, isSpoiler = false): RoleRow {
  return { customRole: name, isSpoiler, roleType: "custom" };
}

function RolePickerWithState({ initialRoles }: { initialRoles: RoleRow[] }) {
  const [roles, setRoles] = useState(initialRoles);
  return <CharacterRolePicker onChange={setRoles} value={roles} />;
}

function rolesCombobox() {
  return screen.getByRole("combobox", { name: "Ролі" });
}

function standardRole(roleType: RoleRow["roleType"], isSpoiler = false): RoleRow {
  return { customRole: "", isSpoiler, roleType };
}

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe("CharacterRolePicker chips", () => {
  it("renders a chip per role in value order, naming standard roles by type and custom roles by their text", () => {
    renderWithProviders(
      <CharacterRolePicker
        onChange={vi.fn()}
        value={[
          standardRole("antagonist"),
          customRole("Друг дитинства"),
          standardRole("protagonist"),
        ]}
      />,
    );

    const removeButtons = screen.getAllByRole("button", { name: /^Прибрати роль/ });
    expect(removeButtons).toHaveLength(3);
    expect(removeButtons[0]).toHaveAccessibleName("Прибрати роль «Антагоніст»");
    expect(removeButtons[1]).toHaveAccessibleName("Прибрати роль «Друг дитинства»");
    expect(removeButtons[2]).toHaveAccessibleName("Прибрати роль «Протагоніст»");
  });

  it("reports each chip's spoiler state as the pressed state of its spoiler toggle", () => {
    renderWithProviders(
      <CharacterRolePicker
        onChange={vi.fn()}
        value={[standardRole("protagonist", true), customRole("Друг дитинства")]}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Позначити «Протагоніст» як спойлер" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Позначити «Друг дитинства» як спойлер" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("flips the spoiler flag of only the toggled role", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CharacterRolePicker
        onChange={onChange}
        value={[
          standardRole("protagonist", true),
          standardRole("antagonist"),
          customRole("Друг дитинства"),
        ]}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Позначити «Антагоніст» як спойлер" }),
    );

    expect(onChange).toHaveBeenCalledExactlyOnceWith([
      standardRole("protagonist", true),
      standardRole("antagonist", true),
      customRole("Друг дитинства"),
    ]);
  });

  it("keeps the role list closed when a spoiler toggle is clicked", async () => {
    renderWithProviders(
      <CharacterRolePicker onChange={vi.fn()} value={[standardRole("protagonist")]} />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Позначити «Протагоніст» як спойлер" }),
    );

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("removes only the role whose remove button is clicked", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CharacterRolePicker
        onChange={onChange}
        value={[
          standardRole("protagonist"),
          standardRole("antagonist"),
          customRole("Друг дитинства"),
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Прибрати роль «Антагоніст»" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith([
      standardRole("protagonist"),
      customRole("Друг дитинства"),
    ]);
  });

  it("moves focus to the roles combobox after a role is removed", async () => {
    renderWithProviders(
      <CharacterRolePicker
        onChange={vi.fn()}
        value={[standardRole("protagonist"), standardRole("antagonist")]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Прибрати роль «Протагоніст»" }));

    expect(rolesCombobox()).toHaveFocus();
  });

  it("removes the last role on Backspace in the empty combobox", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CharacterRolePicker
        onChange={onChange}
        value={[standardRole("antagonist"), standardRole("protagonist")]}
      />,
    );

    await userEvent.click(rolesCombobox());
    await userEvent.keyboard("{Backspace}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith([standardRole("antagonist")]);
  });
});

describe("CharacterRolePicker chip keyboard", () => {
  it("removes the chip on Enter on its remove button while the role list is open, without adding the highlighted role", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CharacterRolePicker
        onChange={onChange}
        value={[standardRole("protagonist"), standardRole("antagonist")]}
      />,
    );

    await userEvent.click(rolesCombobox());
    expect(await screen.findByRole("option", { name: "Девтерагоніст" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Прибрати роль «Антагоніст»" })).toHaveFocus();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith([standardRole("protagonist")]);
  });

  it("flips only that chip's spoiler on Enter on its spoiler toggle while the role list is open, without adding the highlighted role", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CharacterRolePicker
        onChange={onChange}
        value={[standardRole("protagonist", true), standardRole("antagonist")]}
      />,
    );

    await userEvent.click(rolesCombobox());
    expect(await screen.findByRole("option", { name: "Девтерагоніст" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Позначити «Антагоніст» як спойлер" })).toHaveFocus();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith([
      standardRole("protagonist", true),
      standardRole("antagonist", true),
    ]);
  });

  it("keeps the highlighted role on ArrowDown on a chip's remove button while the role list is open", async () => {
    renderWithProviders(
      <CharacterRolePicker
        onChange={vi.fn()}
        value={[standardRole("protagonist"), standardRole("antagonist")]}
      />,
    );

    await userEvent.click(rolesCombobox());
    expect(await screen.findByRole("option", { name: "Девтерагоніст" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Прибрати роль «Антагоніст»" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");

    expect(screen.getByRole("option", { name: "Девтерагоніст" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("flips the spoiler on Enter on a chip's spoiler toggle while the role list is closed", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CharacterRolePicker
        onChange={onChange}
        value={[standardRole("protagonist"), standardRole("antagonist")]}
      />,
    );

    await userEvent.tab();
    expect(
      screen.getByRole("button", { name: "Позначити «Протагоніст» як спойлер" }),
    ).toHaveFocus();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await userEvent.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith([
      standardRole("protagonist", true),
      standardRole("antagonist"),
    ]);
  });

  it("removes the chip on Enter on its remove button while the role list is closed", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CharacterRolePicker
        onChange={onChange}
        value={[standardRole("protagonist"), standardRole("antagonist")]}
      />,
    );

    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Прибрати роль «Протагоніст»" })).toHaveFocus();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await userEvent.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith([standardRole("antagonist")]);
  });
});

describe("CharacterRolePicker role list", () => {
  it("offers the standard roles not yet chosen, without custom, narrator or point-of-view options", async () => {
    renderWithProviders(
      <CharacterRolePicker
        onChange={vi.fn()}
        value={[standardRole("protagonist"), customRole("Друг дитинства")]}
      />,
    );

    await userEvent.click(rolesCombobox());

    const group = await screen.findByRole("group", { name: "Стандартні ролі" });
    expect(
      within(group)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([
      "Девтерагоніст",
      "Антагоніст",
      "Любовний інтерес",
      "Другорядна",
      "Епізодична",
      "Згаданий",
    ]);
  });

  it("opens the role list when the combobox receives keyboard focus", async () => {
    renderWithProviders(<CharacterRolePicker onChange={vi.fn()} value={[]} />);

    await userEvent.tab();

    expect(rolesCombobox()).toHaveFocus();
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
  });

  it("names the open role list", async () => {
    renderWithProviders(<CharacterRolePicker onChange={vi.fn()} value={[]} />);

    await userEvent.click(rolesCombobox());

    expect(await screen.findByRole("listbox", { name: "Варіанти ролей" })).toBeInTheDocument();
  });

  it("moves the caret to the start on Home without moving the highlighted role", async () => {
    renderWithProviders(<CharacterRolePicker onChange={vi.fn()} value={[]} />);

    await userEvent.type(rolesCombobox(), "агон{ArrowDown}");
    expect(await screen.findByRole("option", { name: "Девтерагоніст" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.keyboard("{Home}");

    expect(rolesCombobox()).toHaveProperty("selectionStart", 0);
    expect(screen.getByRole("option", { name: "Девтерагоніст" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("moves the caret to the end on End without moving the highlighted role", async () => {
    renderWithProviders(<CharacterRolePicker onChange={vi.fn()} value={[]} />);

    await userEvent.type(rolesCombobox(), "агон{ArrowLeft}{ArrowLeft}");
    expect(await screen.findByRole("option", { name: "Протагоніст" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.keyboard("{End}");

    expect(rolesCombobox()).toHaveProperty("selectionStart", 4);
    expect(screen.getByRole("option", { name: "Протагоніст" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("narrows the standard roles to those containing the typed text anywhere in the name", async () => {
    renderWithProviders(<CharacterRolePicker onChange={vi.fn()} value={[]} />);

    await userEvent.type(rolesCombobox(), "агон");

    const group = await screen.findByRole("group", { name: "Стандартні ролі" });
    expect(
      within(group)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Протагоніст", "Девтерагоніст", "Антагоніст"]);
  });

  it("lists standard matches above the offer to create the typed text as a new role", async () => {
    renderWithProviders(<CharacterRolePicker onChange={vi.fn()} value={[]} />);

    await userEvent.type(rolesCombobox(), "епіз");

    expect(await screen.findByRole("group", { name: "Створити нову" })).toBeInTheDocument();
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Епізодична",
      "Створити «епіз»",
    ]);
  });

  it("picks the first standard match on Enter rather than creating a custom role", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CharacterRolePicker onChange={onChange} value={[standardRole("protagonist")]} />,
    );

    await userEvent.type(rolesCombobox(), "епіз{Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith([
      standardRole("protagonist"),
      standardRole("episodic"),
    ]);
  });

  it("appends typed text with no standard match as a trimmed custom role on Enter", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CharacterRolePicker onChange={onChange} value={[standardRole("protagonist")]} />,
    );

    await userEvent.type(rolesCombobox(), "  Друг дитинства  {Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith([
      standardRole("protagonist"),
      customRole("Друг дитинства"),
    ]);
  });

  it("does not offer to create a role that equals a standard role name ignoring case and spaces", async () => {
    renderWithProviders(<CharacterRolePicker onChange={vi.fn()} value={[]} />);

    await userEvent.type(rolesCombobox(), "  АНТАГОНІСТ ");

    expect(await screen.findByRole("option", { name: "Антагоніст" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Створити/ })).not.toBeInTheDocument();
  });

  it("reports a custom role typed in another case as already added under its stored name, without offering to create it", async () => {
    renderWithProviders(
      <CharacterRolePicker onChange={vi.fn()} value={[customRole("Друг дитинства")]} />,
    );

    await userEvent.type(rolesCombobox(), "друг ДИТИНСТВА");

    expect(await screen.findByText("Роль «Друг дитинства» уже додано")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Створити/ })).not.toBeInTheDocument();
  });

  it("appends the role highlighted with ArrowDown on Enter", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CharacterRolePicker onChange={onChange} value={[standardRole("protagonist")]} />,
    );

    await userEvent.click(rolesCombobox());
    await userEvent.keyboard("{ArrowDown}");
    expect(await screen.findByRole("option", { name: "Антагоніст" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith([
      standardRole("protagonist"),
      standardRole("antagonist"),
    ]);
  });

  it("offers no option and reports the role as already added when the only matching standard role is already chosen", async () => {
    renderWithProviders(
      <CharacterRolePicker onChange={vi.fn()} value={[standardRole("episodic")]} />,
    );

    await userEvent.type(rolesCombobox(), "Епізодична");

    expect(await screen.findByText("Роль «Епізодична» уже додано")).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("reports a chosen standard role as already added when its name is typed in another case with stray spaces", async () => {
    renderWithProviders(
      <CharacterRolePicker onChange={vi.fn()} value={[standardRole("protagonist")]} />,
    );

    await userEvent.type(rolesCombobox(), "  ПРОТАГОНІСТ ");

    expect(await screen.findByText("Роль «Протагоніст» уже додано")).toBeInTheDocument();
  });

  it("does not submit the surrounding form when Enter picks a role", async () => {
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    renderWithProviders(
      <form onSubmit={onSubmit}>
        <CharacterRolePicker onChange={vi.fn()} value={[]} />
      </form>,
    );

    await userEvent.type(rolesCombobox(), "Друг дитинства{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("CharacterRolePicker focus after a mouse pick", () => {
  it("returns focus to the roles combobox after a standard role is clicked, so typing goes into it", async () => {
    renderWithProviders(<RolePickerWithState initialRoles={[standardRole("protagonist")]} />);

    await userEvent.click(rolesCombobox());
    await userEvent.click(await screen.findByRole("option", { name: "Антагоніст" }));
    await userEvent.keyboard("Наставник");

    expect(rolesCombobox()).toHaveFocus();
    expect(rolesCombobox()).toHaveValue("Наставник");
  });

  it("returns focus to the roles combobox after a new role is created by click, so Backspace removes that role", async () => {
    renderWithProviders(<RolePickerWithState initialRoles={[standardRole("protagonist")]} />);

    await userEvent.type(rolesCombobox(), "Наставник");
    await userEvent.click(await screen.findByRole("option", { name: "Створити «Наставник»" }));
    expect(rolesCombobox()).toHaveFocus();
    expect(screen.getByRole("button", { name: "Прибрати роль «Наставник»" })).toBeInTheDocument();
    await userEvent.keyboard("{Backspace}");

    expect(
      screen.queryByRole("button", { name: "Прибрати роль «Наставник»" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Прибрати роль «Протагоніст»" })).toBeInTheDocument();
  });
});

describe("CharacterRolePicker limit", () => {
  const fiveRoles = [
    standardRole("protagonist"),
    standardRole("antagonist"),
    standardRole("supporting"),
    customRole("Друг дитинства"),
    customRole("Наставник"),
  ];

  it("makes the combobox read-only with a limit placeholder at five roles", () => {
    renderWithProviders(<CharacterRolePicker onChange={vi.fn()} value={fiveRoles} />);

    expect(rolesCombobox()).toHaveAttribute("readonly");
    expect(rolesCombobox()).toHaveAttribute("placeholder", "Ліміт вичерпано — видаліть зайві ролі");
  });

  it("keeps the role list closed at five roles when typing or pressing ArrowDown", async () => {
    renderWithProviders(<CharacterRolePicker onChange={vi.fn()} value={fiveRoles} />);

    await userEvent.type(rolesCombobox(), "Епіз");
    await userEvent.keyboard("{ArrowDown}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("still removes the last role on Backspace at five roles", async () => {
    const onChange = vi.fn();
    renderWithProviders(<CharacterRolePicker onChange={onChange} value={fiveRoles} />);

    await userEvent.click(rolesCombobox());
    await userEvent.keyboard("{Backspace}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith([
      standardRole("protagonist"),
      standardRole("antagonist"),
      standardRole("supporting"),
      customRole("Друг дитинства"),
    ]);
  });

  it("describes the combobox with the hint and the role counter", () => {
    renderWithProviders(
      <CharacterRolePicker
        onChange={vi.fn()}
        value={[standardRole("protagonist"), customRole("Друг дитинства")]}
      />,
    );

    expect(rolesCombobox()).toHaveAccessibleDescription(
      "Стандартні ролі зі списку або власні через Enter, до 5 штук. 2/5",
    );
  });

  it("adds the limit notice to the combobox description at five roles", () => {
    renderWithProviders(<CharacterRolePicker onChange={vi.fn()} value={fiveRoles} />);

    expect(rolesCombobox()).toHaveAccessibleDescription(/Ліміт вичерпано — видаліть зайві ролі/);
  });

  it("keeps the role counter out of live announcements", () => {
    renderWithProviders(
      <CharacterRolePicker
        onChange={vi.fn()}
        value={[standardRole("protagonist"), customRole("Друг дитинства")]}
      />,
    );

    const counter = screen.getByText("2/5");

    expect(counter.closest("[aria-live]")).toBeNull();
  });
});

describe("CharacterRolePicker placeholder", () => {
  it("mirrors the placeholder in a sizer kept out of the accessibility tree, so the field can wrap instead of clipping it", () => {
    renderWithProviders(
      <CharacterRolePicker onChange={vi.fn()} value={[standardRole("protagonist")]} />,
    );

    expect(screen.getByText("Оберіть роль або введіть свою…")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(rolesCombobox()).toHaveAccessibleDescription(
      "Стандартні ролі зі списку або власні через Enter, до 5 штук. 1/5",
    );
  });
});

describe("CharacterRolePicker announcements", () => {
  it("politely announces the added role with the new count", async () => {
    renderWithProviders(<RolePickerWithState initialRoles={[standardRole("protagonist")]} />);

    await userEvent.click(rolesCombobox());
    await userEvent.click(await screen.findByRole("option", { name: "Антагоніст" }));

    expect(screen.getByText("Роль «Антагоніст» додано, обрано 2 з 5")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("politely announces the role removed with its remove button with the new count", async () => {
    renderWithProviders(
      <RolePickerWithState
        initialRoles={[standardRole("protagonist"), customRole("Друг дитинства")]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Прибрати роль «Друг дитинства»" }));

    expect(screen.getByText("Роль «Друг дитинства» прибрано, обрано 1 з 5")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("politely announces the role removed with Backspace with the new count", async () => {
    renderWithProviders(
      <RolePickerWithState
        initialRoles={[standardRole("protagonist"), standardRole("antagonist")]}
      />,
    );

    await userEvent.click(rolesCombobox());
    await userEvent.keyboard("{Backspace}");

    expect(screen.getByText("Роль «Антагоніст» прибрано, обрано 1 з 5")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });
});

describe("CharacterRolePicker with legacy roles over the limit", () => {
  const sevenRoles = [
    standardRole("protagonist"),
    standardRole("deuteragonist"),
    standardRole("antagonist"),
    standardRole("love_interest"),
    standardRole("supporting"),
    customRole("Друг дитинства"),
    customRole("Наставник"),
  ];

  it("renders all seven chips and a 7/5 counter", () => {
    renderWithProviders(<CharacterRolePicker onChange={vi.fn()} value={sevenRoles} />);

    expect(screen.getAllByRole("button", { name: /^Прибрати роль/ })).toHaveLength(7);
    expect(screen.getByText("7/5")).toBeInTheDocument();
  });

  it("removes a role from an over-limit list", async () => {
    const onChange = vi.fn();
    renderWithProviders(<CharacterRolePicker onChange={onChange} value={sevenRoles} />);

    await userEvent.click(screen.getByRole("button", { name: "Прибрати роль «Друг дитинства»" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith([
      standardRole("protagonist"),
      standardRole("deuteragonist"),
      standardRole("antagonist"),
      standardRole("love_interest"),
      standardRole("supporting"),
      customRole("Наставник"),
    ]);
  });

  it("toggles a spoiler in an over-limit list", async () => {
    const onChange = vi.fn();
    renderWithProviders(<CharacterRolePicker onChange={onChange} value={sevenRoles} />);

    await userEvent.click(screen.getByRole("button", { name: "Позначити «Наставник» як спойлер" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith([
      standardRole("protagonist"),
      standardRole("deuteragonist"),
      standardRole("antagonist"),
      standardRole("love_interest"),
      standardRole("supporting"),
      customRole("Друг дитинства"),
      customRole("Наставник", true),
    ]);
  });
});
