import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { screen, userEvent, waitFor, within } from "@/test-utils";

import {
  chooseGuardianship,
  combobox,
  CREATE_BOOKS,
  CREATE_CONTEXTS,
  CREATE_DEFAULT_BOOK_STATE,
  CREATE_DESCRIPTION,
  CREATE_PEOPLE,
  createBodies,
  createButton,
  descriptionField,
  directedSentence,
  goBackToEdgeStep,
  goToBookStep,
  HIDDEN_STEP_CONTENT,
  installCreateApi,
  jsonResponse,
  orientationOption,
  positionsTrigger,
  queueCreateReplies,
  renderCreate,
  spoilersTrigger,
  submitAndWaitForClose,
  writeRequests,
} from "./relationship-create-form.fixtures";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const copy = messages.relationships;
const editor = copy.editor;

const { first: BOOK, second: SECOND_BOOK } = CREATE_BOOKS;
const { ciri: CIRI, geralt: GERALT } = CREATE_PEOPLE;

const APPROVED_COPY = {
  chapterHint: "Для відстеження прогресу за розділами вкажіть номер, наприклад 5",
  descriptionCounter: { empty: "0/5000", fiveLetters: "5/5000" },
  descriptionSpoilerHint: "Приховати текст опису до дозволеного явного розкриття",
  endedWithoutPositionHint:
    "Без позиції завершення читач може побачити, що зв’язок завершився, щойно зв’язок стане доступним",
  hideRelationshipHint:
    "Зв’язок не відображатиметься в читацькому режимі незалежно від прогресу, доки це налаштування ввімкнено",
  secretStatusHint:
    "Цей стан описує секретність зв’язку між персонажами сюжету. Щоб приховати інформацію від читачів, скористайтеся налаштуваннями спойлерів",
  spoilerSummary: {
    hidden: "Зв’язок повністю приховано",
    none: "Додаткове приховування вимкнено",
    some: "Є налаштування приховування",
  },
  stepTwoHeading: "Крок 2 з 2:",
  typeSpoilerHint:
    "Приховати тип, категорію та напрям зв’язку від читача. Ці подробиці можна розкрити лише окремою дозволеною дією",
} as const;

const SPOILER_TOGGLES = [
  {
    expected: {
      hideRelationshipAsSpoiler: false,
      isDescriptionSpoiler: false,
      isTypeSpoiler: true,
    },
    label: editor.spoilers.type,
  },
  {
    expected: {
      hideRelationshipAsSpoiler: false,
      isDescriptionSpoiler: true,
      isTypeSpoiler: false,
    },
    label: editor.spoilers.description,
  },
  {
    expected: {
      hideRelationshipAsSpoiler: true,
      isDescriptionSpoiler: false,
      isTypeSpoiler: false,
    },
    label: editor.spoilers.relationship,
  },
] as const;

const scrollToMock = vi.fn();

function beginningField(role: "spinbutton" | "textbox", name: string): HTMLElement {
  return within(screen.getByRole("group", { name: editor.positions.introduced })).getByRole(role, {
    name,
  });
}

function bookStepHeading(title: string): string {
  return `${APPROVED_COPY.stepTwoHeading} ${title}`;
}

async function openBookStep() {
  await chooseGuardianship();
  await goToBookStep();
}

function spoilerSwitch(name: string): HTMLElement {
  return screen.getByRole("switch", { name });
}

function statusChip(name: string): HTMLElement {
  return within(screen.getByRole("radiogroup", { name: editor.state.status })).getByRole("radio", {
    name,
  });
}

beforeEach(() => {
  installCreateApi();
  Element.prototype.scrollTo = scrollToMock;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("RelationshipEditorDialog create: book details", () => {
  it("S01 R15 opens on the summary, state, strength and description with both sections closed", async () => {
    renderCreate(CREATE_CONTEXTS.series);

    await openBookStep();

    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent(editor.steps.book);
    expect(
      screen.getByRole("heading", { name: bookStepHeading(SECOND_BOOK.title) }),
    ).toBeInTheDocument();
    expect(statusChip(copy.statuses.active)).toBeChecked();
    expect(
      within(screen.getByRole("radiogroup", { name: editor.state.intensity })).getByRole("radio", {
        name: editor.state.intensityNone,
      }),
    ).toBeChecked();
    expect(descriptionField()).toHaveValue("");
    expect(positionsTrigger()).toHaveAttribute("aria-expanded", "false");
    expect(spoilersTrigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: editor.book.label })).not.toBeInTheDocument();
  });

  it("S02 P1-4 keeps the type and direction in the author summary while spoilers hide them", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await chooseGuardianship();
    await userEvent.click(screen.getByRole("radio", { name: orientationOption(CIRI, GERALT) }));
    await goToBookStep();
    await userEvent.click(spoilersTrigger());
    await userEvent.click(spoilerSwitch(editor.spoilers.type));
    await userEvent.click(spoilerSwitch(editor.spoilers.relationship));

    expect(
      screen.getByText(
        directedSentence({ source: CIRI, target: GERALT, type: copy.types.guardian_of }),
        { ignore: HIDDEN_STEP_CONTENT },
      ),
    ).toBeInTheDocument();
  });

  it("S03 counts the description against its 5000 character limit", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await openBookStep();
    expect(descriptionField()).toHaveAccessibleDescription(APPROVED_COPY.descriptionCounter.empty);
    await userEvent.type(descriptionField(), "Друзі");

    expect(descriptionField()).toHaveAccessibleDescription(
      APPROVED_COPY.descriptionCounter.fiveLetters,
    );
  });

  it("S03 sends the description trimmed", async () => {
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    await openBookStep();
    await userEvent.type(descriptionField(), `  ${CREATE_DESCRIPTION}  `);
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      expect.objectContaining({
        initialBookStates: [expect.objectContaining({ description: CREATE_DESCRIPTION })],
      }),
    ]);
  });
});

describe("RelationshipEditorDialog create: beginning and ending", () => {
  it("S04 S05 R20 opens the positions when the status turns ended and still saves without an ending", async () => {
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    await openBookStep();
    await userEvent.click(statusChip(copy.statuses.ended));

    expect(positionsTrigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(APPROVED_COPY.endedWithoutPositionHint)).toBeInTheDocument();
    await submitAndWaitForClose(onClose);
    expect(createBodies()).toEqual([
      expect.objectContaining({
        initialBookStates: [{ ...CREATE_DEFAULT_BOOK_STATE, bookId: BOOK.id, status: "ended" }],
      }),
    ]);
  });

  it("R20 keeps the ending position when the status goes back to active", async () => {
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    await openBookStep();
    await userEvent.click(statusChip(copy.statuses.ended));
    await userEvent.type(
      within(screen.getByRole("group", { name: editor.positions.ended })).getByRole("textbox", {
        name: editor.positions.chapter,
      }),
      "12",
    );
    await userEvent.click(statusChip(copy.statuses.active));
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      expect.objectContaining({
        initialBookStates: [expect.objectContaining({ endedChapter: "12", status: "active" })],
      }),
    ]);
  });

  it("S04 R28 P1-1 leaves closed positions closed across Back and Next until the status turns ended again", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await openBookStep();
    await userEvent.click(statusChip(copy.statuses.ended));
    await userEvent.click(positionsTrigger());
    await goBackToEdgeStep();
    await goToBookStep();
    expect(positionsTrigger()).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(statusChip(copy.statuses.active));
    await userEvent.click(statusChip(copy.statuses.ended));

    expect(positionsTrigger()).toHaveAttribute("aria-expanded", "true");
  });

  it("R18 sends the chapter, page and audio time of the beginning", async () => {
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    await openBookStep();
    await userEvent.click(positionsTrigger());
    await userEvent.type(beginningField("textbox", editor.positions.chapter), "5");
    await userEvent.type(beginningField("spinbutton", editor.positions.page), "120");
    await userEvent.type(beginningField("textbox", editor.positions.audio), "1:05:30");
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      expect.objectContaining({
        initialBookStates: [
          expect.objectContaining({
            introducedAudioSeconds: 3930,
            introducedChapter: "5",
            introducedPage: 120,
          }),
        ],
      }),
    ]);
  });

  it("S05 recommends a numeric chapter for reading progress", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await openBookStep();
    await userEvent.click(positionsTrigger());

    expect(screen.getByText(APPROVED_COPY.chapterHint)).toBeInTheDocument();
  });

  it("R19 S08 P0-2 reopens closed positions and focuses an invalid audio time instead of saving", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await openBookStep();
    await userEvent.click(positionsTrigger());
    await userEvent.type(beginningField("textbox", editor.positions.audio), "abc");
    await userEvent.click(positionsTrigger());
    await userEvent.click(createButton());

    await waitFor(() => expect(beginningField("textbox", editor.positions.audio)).toHaveFocus());
    expect(positionsTrigger()).toHaveAttribute("aria-expanded", "true");
    expect(beginningField("textbox", editor.positions.audio)).toHaveAccessibleDescription(
      editor.errors.audioInvalid,
    );
    expect(createBodies()).toEqual([]);
  });

  it("R19 S08 P0-2 reopens closed positions and focuses the page the server rejected", async () => {
    queueCreateReplies(
      jsonResponse(
        {
          errorsMessages: [
            { field: "initialBookStates.0.introducedPage", message: "Page is out of range" },
          ],
        },
        400,
      ),
    );
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    await openBookStep();
    await userEvent.click(positionsTrigger());
    await userEvent.type(beginningField("spinbutton", editor.positions.page), "120");
    await userEvent.click(positionsTrigger());
    await userEvent.click(createButton());

    await waitFor(() => expect(beginningField("spinbutton", editor.positions.page)).toHaveFocus());
    expect(positionsTrigger()).toHaveAttribute("aria-expanded", "true");
    expect(beginningField("spinbutton", editor.positions.page)).toHaveAccessibleDescription(
      editor.errors.invalidValue,
    );
    expect(createButton()).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("RelationshipEditorDialog create: spoilers and visibility", () => {
  it("S06 sums up the spoiler settings in the closed section header", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await openBookStep();
    expect(spoilersTrigger()).toHaveTextContent(APPROVED_COPY.spoilerSummary.none);
    await userEvent.click(spoilersTrigger());
    await userEvent.click(spoilerSwitch(editor.spoilers.description));
    await userEvent.click(spoilersTrigger());
    expect(spoilersTrigger()).toHaveTextContent(APPROVED_COPY.spoilerSummary.some);
    await userEvent.click(spoilersTrigger());
    await userEvent.click(spoilerSwitch(editor.spoilers.relationship));
    await userEvent.click(spoilersTrigger());

    expect(spoilersTrigger()).toHaveTextContent(APPROVED_COPY.spoilerSummary.hidden);
  });

  it("S07 R22 R23 explains every spoiler switch with the approved text", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await openBookStep();
    await userEvent.click(spoilersTrigger());

    expect(spoilerSwitch(editor.spoilers.type)).toHaveAccessibleDescription(
      APPROVED_COPY.typeSpoilerHint,
    );
    expect(spoilerSwitch(editor.spoilers.description)).toHaveAccessibleDescription(
      APPROVED_COPY.descriptionSpoilerHint,
    );
    expect(spoilerSwitch(editor.spoilers.relationship)).toHaveAccessibleDescription(
      APPROVED_COPY.hideRelationshipHint,
    );
  });

  it("R23 marks a spoiler switch the server rejected and describes it with its hint and the error", async () => {
    queueCreateReplies(
      jsonResponse(
        {
          errorsMessages: [
            { field: "initialBookStates.0.isTypeSpoiler", message: "Spoiler flag is invalid" },
          ],
        },
        400,
      ),
    );
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    await openBookStep();
    await userEvent.click(createButton());

    await waitFor(() =>
      expect(spoilerSwitch(editor.spoilers.type)).toHaveAttribute("aria-invalid", "true"),
    );
    expect(spoilerSwitch(editor.spoilers.type)).toHaveAccessibleDescription(
      `${APPROVED_COPY.typeSpoilerHint} ${editor.errors.invalidValue}`,
    );
    expect(screen.getByText(editor.errors.invalidValue)).toHaveRole("alert");
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each(SPOILER_TOGGLES)(
    "R23 S06 sends «$label» as its own flag",
    async ({ expected, label }) => {
      const { onClose } = renderCreate(CREATE_CONTEXTS.book);

      await openBookStep();
      await userEvent.click(spoilersTrigger());
      await userEvent.click(spoilerSwitch(label));
      await submitAndWaitForClose(onClose);

      expect(createBodies()).toEqual([
        expect.objectContaining({ initialBookStates: [expect.objectContaining(expected)] }),
      ]);
    },
  );

  it("R21 S07 explains the secret status as a plot secret and leaves the spoiler flags off", async () => {
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    await openBookStep();
    await userEvent.click(statusChip(copy.statuses.hidden));
    expect(screen.getByText(APPROVED_COPY.secretStatusHint)).toHaveRole("status");
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      expect.objectContaining({
        initialBookStates: [{ ...CREATE_DEFAULT_BOOK_STATE, bookId: BOOK.id, status: "hidden" }],
      }),
    ]);
  });
});

describe("RelationshipEditorDialog create: moving between steps", () => {
  it("S08 scrolls the fields to the top and focuses the book heading on Next", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await chooseGuardianship();
    scrollToMock.mockClear();
    await userEvent.click(screen.getByRole("button", { name: editor.actions.next }));

    const heading = await screen.findByRole("heading", { name: bookStepHeading(BOOK.title) });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(scrollToMock).toHaveBeenLastCalledWith({ top: 0 });
    expect(scrollToMock.mock.contexts.at(-1)).toContainElement(heading);
  });

  it("S08 R29 scrolls the fields to the top and focuses the first participant on Back without a discard prompt", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await openBookStep();
    scrollToMock.mockClear();
    await userEvent.click(screen.getByRole("button", { name: editor.actions.back }));

    await waitFor(() => expect(combobox(editor.participants.source)).toHaveFocus());
    expect(scrollToMock).toHaveBeenLastCalledWith({ top: 0 });
    expect(scrollToMock.mock.contexts.at(-1)).toContainElement(
      combobox(editor.participants.source),
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("S08 R29 focuses the book choice on Back when the series offers several books", async () => {
    renderCreate(CREATE_CONTEXTS.series);

    await openBookStep();
    await userEvent.click(screen.getByRole("button", { name: editor.actions.back }));

    await waitFor(() => expect(combobox(editor.book.label)).toHaveFocus());
  });

  it("R28 P12 S09 restores the direction, details and opened sections after Back and Next without saving", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await chooseGuardianship();
    await userEvent.click(screen.getByRole("radio", { name: orientationOption(CIRI, GERALT) }));
    await goToBookStep();
    await userEvent.type(descriptionField(), CREATE_DESCRIPTION);
    await userEvent.click(spoilersTrigger());
    await goBackToEdgeStep();
    expect(screen.getByRole("radio", { name: orientationOption(CIRI, GERALT) })).toBeChecked();
    await goToBookStep();

    expect(descriptionField()).toHaveValue(CREATE_DESCRIPTION);
    expect(spoilersTrigger()).toHaveAttribute("aria-expanded", "true");
    expect(writeRequests()).toEqual([]);
  });
});
