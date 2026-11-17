import "@testing-library/jest-dom/vitest";

import type { CharacterRelationshipCustomTypeView } from "@app/shared";
import type { ReactNode } from "react";

import { RELATIONSHIP_CATEGORY_TYPES } from "@app/shared";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { screen, userEvent, waitFor, within } from "@/test-utils";

import type { RelationshipParticipant } from "../model/relationship-form-schema";

import { makeCharacterPage, makeEditableRelationship } from "../model/relationships.fixtures";
import {
  chooseGuardianship,
  combobox,
  CREATE_API,
  CREATE_BOOKS,
  CREATE_CONTEXTS,
  CREATE_DEFAULT_BOOK_STATE,
  CREATE_DESCRIPTION,
  CREATE_PEOPLE,
  createBodies,
  createButton,
  descriptionField,
  directedSentence,
  endingWith,
  getRequests,
  goBackToEdgeStep,
  goToBookStep,
  HIDDEN_STEP_CONTENT,
  installCreateApi,
  jsonResponse,
  orientationOption,
  pickParticipant,
  pickType,
  positionsTrigger,
  queueCreateReplies,
  queueRosterReplies,
  renderCreate,
  respondToCustomTypes,
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
const { ciri: CIRI, geralt: GERALT, yennefer: YENNEFER } = CREATE_PEOPLE;

const SAVED_CUSTOM_TYPES = {
  directed: { directionality: "directed", id: "custom-type-2", name: "Сюзерен" },
  symmetric: { directionality: "symmetric", id: "custom-type-1", name: "Побратими" },
} as const satisfies Record<string, CharacterRelationshipCustomTypeView>;

const LIST_METRICS = {
  clientHeight: 240,
  properties: ["clientHeight", "scrollHeight", "scrollTop"],
  rowHeight: 40,
} as const;

const SERVER_REPLIES = {
  bookContextInvalid: {
    code: "relationship_book_context_invalid",
    message: "Both characters must appear in the book",
  },
  duplicate: { code: "relationship_duplicate", message: "This relationship already exists" },
  selfReference: {
    code: "relationship_self_reference",
    message: "A character cannot be related to itself",
  },
  serverError: { message: "Internal server error" },
} as const;

const STANDARD_CATALOG = {
  categories: [
    "family",
    "romantic",
    "social",
    "conflict",
    "mentorship",
    "hierarchy",
    "supernatural",
  ],
  portionRows: 12,
} as const;

const TYPED_TEXT = {
  ownType: { collapsed: "Кровні брати", typed: "  Кровні   брати  " },
  typeSearch: "Переслід",
} as const;

const BLOCKING_FAMILY_CYCLES = [
  { details: { severity: "conflict" }, reason: "a conflict" },
  { details: undefined, reason: "no severity" },
] as const;

type StandardCategory = (typeof STANDARD_CATALOG.categories)[number];

function catalogTypeLabels(category: StandardCategory): string[] {
  return RELATIONSHIP_CATEGORY_TYPES[category].map((type) => copy.types[type]);
}

async function chooseBook(title: string) {
  await userEvent.click(combobox(editor.book.label));
  await userEvent.click(await screen.findByRole("option", { name: title }));
}

async function chooseBothParticipants() {
  await pickParticipant({ name: GERALT.name, slot: editor.participants.source });
  await pickParticipant({ name: CIRI.name, slot: editor.participants.target });
}

function customDirection(name: string): HTMLElement {
  return within(screen.getByRole("radiogroup", { name: editor.type.directionality })).getByRole(
    "radio",
    { name },
  );
}

async function enterDetailsAndReturn() {
  await goToBookStep();
  await userEvent.type(descriptionField(), CREATE_DESCRIPTION);
  await goBackToEdgeStep();
}

function familyCycleReply(details?: Record<string, string>): Response {
  return jsonResponse(
    {
      code: "family_cycle_detected",
      ...(details === undefined ? {} : { details }),
      message: "The visible family relationships form an ancestry cycle",
    },
    409,
  );
}

function listOptions(): HTMLElement[] {
  return within(screen.getByRole("listbox")).getAllByRole("option");
}

function orientationRadio(source: RelationshipParticipant, target: RelationshipParticipant) {
  return screen.getByRole("radio", { name: orientationOption(source, target) });
}

function ownTypeName(): HTMLElement {
  return combobox(editor.type.customLabel);
}

function preview(): HTMLElement {
  return screen.getByRole("region", { name: editor.preview.title });
}

function rosterPaths(): string[] {
  return [...new Set(getRequests().map((url) => url.pathname))].filter(
    (pathname) => pathname !== CREATE_API.customTypes,
  );
}

async function scrollListBy(distance: number) {
  const wheel = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: distance });
  await act(async () => {
    screen.getByRole("listbox").dispatchEvent(wheel);
  });
}

async function scrollTypePortion() {
  await scrollListBy(LIST_METRICS.rowHeight * STANDARD_CATALOG.portionRows);
}

function shownTypeCategories(): StandardCategory[] {
  const list = within(typeList());
  return STANDARD_CATALOG.categories.filter(
    (category) => list.queryByRole("group", { name: copy.categories[category] }) !== null,
  );
}

async function startOwnType() {
  await userEvent.click(combobox(editor.type.label));
  await userEvent.click(screen.getByRole("button", { name: editor.type.ownType }));
}

function stubListMetrics(): () => void {
  const originals = LIST_METRICS.properties.map(
    (name) => [name, Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)] as const,
  );
  const scrollTops = new WeakMap<HTMLElement, number>();

  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => LIST_METRICS.clientHeight,
  });
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return (
        within(this).queryAllByRole("option", { hidden: true }).length * LIST_METRICS.rowHeight
      );
    },
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTop", {
    configurable: true,
    get(this: HTMLElement) {
      return scrollTops.get(this) ?? 0;
    },
    set(this: HTMLElement, next: number) {
      scrollTops.set(this, next);
    },
  });

  return () => {
    for (const [name, descriptor] of originals) {
      if (descriptor === undefined) {
        Reflect.deleteProperty(HTMLElement.prototype, name);
        continue;
      }
      Object.defineProperty(HTMLElement.prototype, name, descriptor);
    }
  };
}

async function submitRejectedDraft(): Promise<HTMLElement> {
  await chooseGuardianship();
  await goToBookStep();
  await userEvent.click(createButton());
  return screen.findByRole("group", { name: editor.participants.legend });
}

function symmetricSentence(first: RelationshipParticipant, second: RelationshipParticipant) {
  return editor.preview.symmetric.replace("{first}", first.name).replace("{second}", second.name);
}

function typedNameOption(name: string): string {
  return editor.customType.useTyped.replace("{name}", name);
}

function typeGroupLabels(category: StandardCategory) {
  const group = within(typeList()).getByRole("group", { name: copy.categories[category] });
  const options = within(group).getAllByRole("option");
  return options.map((option) => option.textContent);
}

function typeList(): HTMLElement {
  return screen.getByRole("listbox", { name: editor.type.results });
}

function typeListPage() {
  return { categories: shownTypeCategories(), rows: listOptions().length };
}

beforeEach(() => {
  installCreateApi();
  respondToCustomTypes(() =>
    jsonResponse(makeCharacterPage([SAVED_CUSTOM_TYPES.symmetric, SAVED_CUSTOM_TYPES.directed])),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("RelationshipEditorDialog create: book context", () => {
  it("R01 R15 R42 R44 creates one default book state for the fixed page book with unset labels", async () => {
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    expect(screen.queryByRole("combobox", { name: editor.book.label })).not.toBeInTheDocument();
    expect(screen.getByText(BOOK.title, { ignore: HIDDEN_STEP_CONTENT })).toBeInTheDocument();
    await chooseGuardianship();
    await goToBookStep();
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      {
        allowFamilyCycle: false,
        category: "family",
        customType: null,
        directionality: "directed",
        initialBookStates: [{ ...CREATE_DEFAULT_BOOK_STATE, bookId: BOOK.id }],
        isCanonical: false,
        sourceCharacterId: GERALT.id,
        sourceLabel: null,
        targetCharacterId: CIRI.id,
        targetLabel: null,
        type: "guardian_of",
      },
    ]);
    expect(writeRequests()).toEqual([`POST ${CREATE_API.relationships}`]);
    expect(rosterPaths()).toEqual([`/api/books/${BOOK.id}/characters`]);
  });

  it("R02 R45 keeps the page character fixed and offers the other one only from the book", async () => {
    renderCreate(CREATE_CONTEXTS.characterInBook);

    expect(screen.getByText(editor.participants.focus)).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: editor.participants.source }),
    ).not.toBeInTheDocument();
    await userEvent.click(combobox(editor.participants.target));

    expect(await screen.findByRole("option", { name: endingWith(CIRI.name) })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: endingWith(YENNEFER.name) })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: endingWith(GERALT.name) })).not.toBeInTheDocument();
    expect(rosterPaths()).toEqual([`/api/books/${BOOK.id}/characters`]);
  });

  it("R03 R46 uses the only book of a global character without a book field", async () => {
    const { onClose } = renderCreate(CREATE_CONTEXTS.globalCharacterWithOneBook);

    expect(screen.queryByRole("combobox", { name: editor.book.label })).not.toBeInTheDocument();
    await pickParticipant({ name: CIRI.name, slot: editor.participants.target });
    await pickType(copy.types.guardian_of);
    await goToBookStep();
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      expect.objectContaining({
        initialBookStates: [expect.objectContaining({ bookId: BOOK.id })],
        sourceCharacterId: GERALT.id,
        targetCharacterId: CIRI.id,
      }),
    ]);
  });

  it("R03 R13 R47 makes a global character with several books pick one before Next", async () => {
    renderCreate(CREATE_CONTEXTS.globalCharacter);

    expect(combobox(editor.book.label)).toHaveTextContent(editor.book.placeholder);
    expect(combobox(editor.participants.target)).toBeDisabled();
    expect(combobox(editor.participants.target)).toHaveAccessibleDescription(
      editor.participants.bookFirst,
    );
    await pickType(copy.types.guardian_of);
    await userEvent.click(screen.getByRole("button", { name: editor.actions.next }));

    await waitFor(() => expect(combobox(editor.book.label)).toHaveFocus());
    expect(combobox(editor.book.label)).toHaveAccessibleDescription(editor.errors.bookRequired);
    expect(screen.queryByRole("button", { name: editor.actions.create })).not.toBeInTheDocument();
    expect(getRequests()).toEqual([]);
  });

  it("R03 R47 creates exactly one book state for the book the author picked", async () => {
    const { onClose } = renderCreate(CREATE_CONTEXTS.globalCharacter);

    await chooseBook(SECOND_BOOK.title);
    await pickParticipant({ name: CIRI.name, slot: editor.participants.target });
    await pickType(copy.types.guardian_of);
    await goToBookStep();
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      expect.objectContaining({
        initialBookStates: [expect.objectContaining({ bookId: SECOND_BOOK.id })],
      }),
    ]);
    expect(rosterPaths()).toEqual([`/api/books/${SECOND_BOOK.id}/characters`]);
  });

  it("R14 R48 blocks creating for a global character that is in no book", async () => {
    renderCreate(CREATE_CONTEXTS.globalCharacterWithoutBooks);

    expect(screen.getByText(editor.book.blocked.characterTitle)).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: editor.participants.target }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: editor.actions.next }));

    expect(screen.getByRole("button", { name: editor.actions.next })).toBeDisabled();
    expect(getRequests()).toEqual([]);
    expect(writeRequests()).toEqual([]);
  });

  it("R04 R49 preselects the series context book and offers every series book", async () => {
    renderCreate(CREATE_CONTEXTS.series);

    expect(combobox(editor.book.label)).toHaveTextContent(SECOND_BOOK.title);
    await userEvent.click(combobox(editor.book.label));

    const books = within(await screen.findByRole("listbox")).getAllByRole("option");
    expect(books.map((book) => book.textContent)).toEqual([BOOK.title, SECOND_BOOK.title]);
  });

  it("R04 R49 creates for another series book picked on the first step", async () => {
    const { onClose } = renderCreate(CREATE_CONTEXTS.series);

    await chooseBook(BOOK.title);
    await chooseGuardianship();
    await goToBookStep();
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      expect.objectContaining({
        initialBookStates: [expect.objectContaining({ bookId: BOOK.id })],
      }),
    ]);
  });

  it("R04 R13 R49 asks a series without a context book to pick one before Next", async () => {
    renderCreate(CREATE_CONTEXTS.seriesWithoutContext);

    expect(combobox(editor.book.label)).toHaveTextContent(editor.book.placeholder);
    expect(combobox(editor.participants.source)).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: editor.actions.next }));

    await waitFor(() =>
      expect(combobox(editor.book.label)).toHaveAccessibleDescription(editor.errors.bookRequired),
    );
    expect(screen.queryByRole("button", { name: editor.actions.create })).not.toBeInTheDocument();
  });

  it("R50 blocks creating in a series without books", async () => {
    renderCreate(CREATE_CONTEXTS.seriesWithoutBooks);

    expect(screen.getByText(editor.book.blocked.seriesTitle)).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: editor.participants.source }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: editor.actions.next }));

    expect(screen.getByRole("button", { name: editor.actions.next })).toBeDisabled();
    expect(writeRequests()).toEqual([]);
  });
});

describe("RelationshipEditorDialog create: participants", () => {
  it("R44 R51 browses participants only in the selected book, 20 at a time by name", async () => {
    renderCreate(CREATE_CONTEXTS.series);

    await pickParticipant({ name: GERALT.name, slot: editor.participants.source });

    expect(rosterPaths()).toEqual([`/api/books/${SECOND_BOOK.id}/characters`]);
    expect(getRequests().map((url) => Object.fromEntries(url.searchParams))).toContainEqual({
      pageNumber: "1",
      pageSize: "20",
      sort: "name",
    });
  });

  it("R52 explains that one letter is too short instead of searching", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await userEvent.click(combobox(editor.participants.source));
    await screen.findByRole("option", { name: endingWith(CIRI.name) });
    await userEvent.type(combobox(editor.picker.search), CIRI.name.charAt(0));

    expect(await screen.findByText(editor.picker.hint)).toHaveRole("status");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.queryByText(editor.picker.empty)).not.toBeInTheDocument();
  });

  it("R32 reports a failed character search in a status with a Retry option, not an alert", async () => {
    queueRosterReplies(jsonResponse(SERVER_REPLIES.serverError, 500));
    renderCreate(CREATE_CONTEXTS.book);

    await userEvent.click(combobox(editor.participants.source));

    expect(await screen.findByText(editor.picker.error)).toHaveRole("status");
    const results = screen.getByRole("listbox", { name: editor.picker.results });
    expect(
      within(results).getByRole("option", { name: messages.common.retry }),
    ).toBeInTheDocument();
    expect(within(results).queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: messages.common.retry })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("R12 does not offer the character already chosen on the other side", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await pickParticipant({ name: CIRI.name, slot: editor.participants.source });
    await userEvent.click(combobox(editor.participants.target));

    expect(
      await screen.findByRole("option", { name: endingWith(GERALT.name) }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: endingWith(CIRI.name) })).not.toBeInTheDocument();
  });

  it("P07 offers no swap while one side is the page character", async () => {
    renderCreate(CREATE_CONTEXTS.characterInBook);

    await pickParticipant({ name: CIRI.name, slot: editor.participants.target });
    await pickType(copy.types.guardian_of);

    expect(orientationRadio(GERALT, CIRI)).toBeChecked();
    expect(
      screen.queryByRole("button", { name: editor.participants.swap }),
    ).not.toBeInTheDocument();
  });

  it("R11 swaps two free characters on screen and keeps the saved endpoints", async () => {
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    await chooseGuardianship();
    await userEvent.click(screen.getByRole("button", { name: editor.participants.swap }));

    expect(combobox(editor.participants.source)).toHaveTextContent(CIRI.name);
    expect(combobox(editor.participants.target)).toHaveTextContent(GERALT.name);
    expect(orientationRadio(GERALT, CIRI)).toBeChecked();
    expect(preview()).toHaveTextContent(
      directedSentence({ source: GERALT, target: CIRI, type: copy.types.guardian_of }),
    );
    await goToBookStep();
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      expect.objectContaining({
        sourceCharacterId: GERALT.id,
        sourceLabel: null,
        targetCharacterId: CIRI.id,
        targetLabel: null,
        type: "guardian_of",
      }),
    ]);
  });
});

describe("RelationshipEditorDialog create: picker lists", () => {
  let restoreListMetrics: () => void = () => undefined;

  beforeEach(() => {
    restoreListMetrics = stubListMetrics();
  });

  afterEach(() => {
    restoreListMetrics();
  });

  it("R05 R35 opens with eight category chips, the first 12 types and the own type action", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await userEvent.click(combobox(editor.type.label));

    const chips = within(
      screen.getByRole("radiogroup", { name: editor.type.category }),
    ).getAllByRole("radio");
    expect(chips.map((chip) => chip.textContent)).toEqual([
      editor.type.allCategories,
      copy.categories.family,
      copy.categories.romantic,
      copy.categories.social,
      copy.categories.conflict,
      copy.categories.mentorship,
      copy.categories.hierarchy,
      copy.categories.supernatural,
    ]);
    expect(listOptions()).toHaveLength(12);
    expect(
      within(screen.getByRole("listbox")).queryByText(copy.directionality.directed),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: editor.type.ownType })).toBeInTheDocument();
  });

  it("R36 shows 12 more types at each list end until all 71 catalog types, without a request", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await userEvent.click(combobox(editor.type.label));
    const pages = [typeListPage()];
    await scrollTypePortion();
    pages.push(typeListPage());
    await scrollTypePortion();
    pages.push(typeListPage());
    await scrollTypePortion();
    pages.push(typeListPage());
    await scrollTypePortion();
    pages.push(typeListPage());
    await scrollTypePortion();
    pages.push(typeListPage());

    expect(pages).toEqual([
      { categories: ["family"], rows: 12 },
      { categories: ["family", "romantic"], rows: 24 },
      { categories: ["family", "romantic", "social", "conflict"], rows: 36 },
      { categories: ["family", "romantic", "social", "conflict", "mentorship"], rows: 48 },
      { categories: STANDARD_CATALOG.categories, rows: 60 },
      { categories: STANDARD_CATALOG.categories, rows: 71 },
    ]);
    expect(listOptions().map((option) => option.textContent)).toEqual(
      STANDARD_CATALOG.categories.flatMap(catalogTypeLabels),
    );
    expect(STANDARD_CATALOG.categories.map(typeGroupLabels)).toEqual(
      STANDARD_CATALOG.categories.map(catalogTypeLabels),
    );
    expect(getRequests().filter((url) => url.pathname !== CREATE_API.customTypes)).toEqual([]);
    expect(writeRequests()).toEqual([]);
  });

  it("R37 finds the last catalog type by search and puts the category back to All", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await userEvent.click(combobox(editor.type.label));
    const categories = screen.getByRole("radiogroup", { name: editor.type.category });
    await userEvent.click(
      within(categories).getByRole("radio", { name: copy.categories.romantic }),
    );
    await userEvent.type(screen.getByPlaceholderText(editor.type.search), copy.types.clone_of);

    expect(
      within(categories).getByRole("radio", { name: editor.type.allCategories }),
    ).toBeChecked();
    expect(listOptions().map((option) => option.textContent)).toEqual([copy.types.clone_of]);
  });

  it("R05 R38 restarts the list for a new category and keeps the chosen type", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await pickType(copy.types.guardian_of);
    await userEvent.click(combobox(editor.type.label));
    await scrollListBy(LIST_METRICS.clientHeight);
    expect(listOptions()).toHaveLength(24);
    await userEvent.click(
      within(screen.getByRole("radiogroup", { name: editor.type.category })).getByRole("radio", {
        name: copy.categories.family,
      }),
    );

    expect(listOptions()).toHaveLength(12);
    expect(screen.getByRole("listbox").scrollTop).toBe(0);
    await userEvent.keyboard("{Escape}");
    expect(combobox(editor.type.label)).toHaveTextContent(copy.types.guardian_of);
  });

  it("R39 shows the empty state and keeps the own type action when nothing matches", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await userEvent.click(combobox(editor.type.label));
    await userEvent.type(screen.getByPlaceholderText(editor.type.search), "zzz");

    expect(await screen.findByText(editor.type.empty)).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: editor.type.ownType })).toBeEnabled();
  });

  it("T04 R52 scrolls the participant list back to the top for a server search", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await userEvent.click(combobox(editor.participants.source));
    await screen.findByRole("option", { name: endingWith(CIRI.name) });
    await scrollListBy(LIST_METRICS.rowHeight);
    expect(screen.getByRole("listbox", { name: editor.picker.results }).scrollTop).toBe(
      LIST_METRICS.rowHeight,
    );
    await userEvent.type(combobox(editor.picker.search), "Ці");

    expect(screen.getByRole("listbox", { name: editor.picker.results }).scrollTop).toBe(0);
    await waitFor(() =>
      expect(getRequests().map((url) => url.searchParams.get("search"))).toContain("Ці"),
    );
    expect(rosterPaths()).toEqual([`/api/books/${BOOK.id}/characters`]);
  });
});

describe("RelationshipEditorDialog create: own type", () => {
  it("R09 P09 T15 accepts a one letter own type and sends it as a custom symmetric type", async () => {
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    await chooseBothParticipants();
    await startOwnType();
    expect(customDirection(editor.customType.symmetric)).toBeChecked();
    expect(
      screen.queryByRole("radiogroup", { name: editor.orientation.legend }),
    ).not.toBeInTheDocument();
    await userEvent.type(ownTypeName(), "Б");
    expect(ownTypeName()).toHaveAccessibleDescription(editor.customType.searchHint);
    expect(ownTypeName()).toHaveAttribute("aria-invalid", "false");
    await goToBookStep();
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      expect.objectContaining({
        category: "custom",
        customType: "Б",
        directionality: "symmetric",
        type: "custom",
      }),
    ]);
    expect(writeRequests()).toEqual([`POST ${CREATE_API.relationships}`]);
    expect(getRequests().some((url) => url.searchParams.has("q"))).toBe(false);
  });

  it("R09 P10 fills an own type from the saved ones and sends a changed direction", async () => {
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    await chooseBothParticipants();
    await startOwnType();
    await userEvent.click(ownTypeName());
    const suggestions = await screen.findByRole("listbox", {
      name: editor.customType.suggestions,
    });
    const directedSuggestion = await within(suggestions).findByRole("option", {
      name: new RegExp(`^${SAVED_CUSTOM_TYPES.directed.name}`),
    });
    expect(within(directedSuggestion).getByText(copy.directionality.directed)).toBeInTheDocument();
    await userEvent.click(directedSuggestion);
    expect(ownTypeName()).toHaveValue(SAVED_CUSTOM_TYPES.directed.name);
    expect(ownTypeName()).toHaveFocus();
    expect(customDirection(editor.customType.directed)).toBeChecked();
    expect(orientationRadio(GERALT, CIRI)).toBeChecked();
    await userEvent.click(customDirection(editor.customType.symmetric));
    expect(
      screen.queryByRole("radiogroup", { name: editor.orientation.legend }),
    ).not.toBeInTheDocument();
    await goToBookStep();
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      expect.objectContaining({
        category: "custom",
        customType: SAVED_CUSTOM_TYPES.directed.name,
        directionality: "symmetric",
        type: "custom",
      }),
    ]);
    expect(writeRequests()).toEqual([`POST ${CREATE_API.relationships}`]);
  });

  it("T15 P09 sends a new directed own type even when the saved ones fail to load", async () => {
    respondToCustomTypes(() => jsonResponse(SERVER_REPLIES.serverError, 500));
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    await chooseBothParticipants();
    await startOwnType();
    await userEvent.click(ownTypeName());
    expect(await screen.findByText(editor.customType.error)).toHaveRole("status");
    await userEvent.type(ownTypeName(), SAVED_CUSTOM_TYPES.symmetric.name);
    await userEvent.click(customDirection(editor.customType.directed));
    expect(orientationRadio(GERALT, CIRI)).toBeChecked();
    await goToBookStep();
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      expect.objectContaining({
        customType: SAVED_CUSTOM_TYPES.symmetric.name,
        directionality: "directed",
        sourceCharacterId: GERALT.id,
        targetCharacterId: CIRI.id,
        type: "custom",
      }),
    ]);
  });

  it("R10 P11 sends a catalog type picked after an own type without the own name", async () => {
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    await chooseBothParticipants();
    await startOwnType();
    await userEvent.type(ownTypeName(), SAVED_CUSTOM_TYPES.symmetric.name);
    await pickType(copy.types.friend_of);
    await goToBookStep();
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      expect.objectContaining({
        category: "social",
        customType: null,
        directionality: "symmetric",
        type: "friend_of",
      }),
    ]);
  });

  it("T11 P11 brings the own type draft back after a catalog type was picked", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await startOwnType();
    await userEvent.type(ownTypeName(), SAVED_CUSTOM_TYPES.symmetric.name);
    await pickType(copy.types.friend_of);
    expect(
      screen.queryByRole("combobox", { name: editor.type.customLabel }),
    ).not.toBeInTheDocument();
    await startOwnType();

    expect(ownTypeName()).toHaveValue(SAVED_CUSTOM_TYPES.symmetric.name);
  });

  it("R13 asks for the own type name before Next", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await chooseBothParticipants();
    await startOwnType();
    await userEvent.click(screen.getByRole("button", { name: editor.actions.next }));

    await waitFor(() =>
      expect(ownTypeName()).toHaveAccessibleDescription(editor.errors.customTypeRequired),
    );
    expect(screen.queryByRole("button", { name: editor.actions.create })).not.toBeInTheDocument();
  });

  it("R09 keeps the own type suggestions closed on focus until the author clicks the name", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await startOwnType();
    await waitFor(() => expect(ownTypeName()).toHaveFocus());
    expect(ownTypeName()).toHaveAttribute("aria-expanded", "false");
    expect(ownTypeName()).not.toHaveAttribute("aria-controls");
    expect(ownTypeName()).toHaveAttribute("aria-required", "true");
    expect(
      screen.queryByRole("listbox", { name: editor.customType.suggestions }),
    ).not.toBeInTheDocument();
    expect(getRequests()).toEqual([]);
    await userEvent.click(ownTypeName());

    const suggestions = await screen.findByRole("listbox", {
      name: editor.customType.suggestions,
    });
    expect(ownTypeName()).toHaveAttribute("aria-expanded", "true");
    expect(ownTypeName()).toHaveAttribute("aria-controls", suggestions.id);
  });

  it("R09 P10 offers the exact saved match first and picks it with Enter in its own direction", async () => {
    const typed = SAVED_CUSTOM_TYPES.directed.name.toLocaleLowerCase();
    renderCreate(CREATE_CONTEXTS.book);

    await startOwnType();
    await userEvent.type(ownTypeName(), typed);
    const exactMatch = await screen.findByRole("option", {
      name: new RegExp(`^${SAVED_CUSTOM_TYPES.directed.name}`),
      selected: true,
    });
    expect(listOptions()[0]).toBe(exactMatch);
    expect(screen.queryByRole("option", { name: typedNameOption(typed) })).not.toBeInTheDocument();
    await userEvent.keyboard("{Enter}");

    expect(ownTypeName()).toHaveValue(SAVED_CUSTOM_TYPES.directed.name);
    expect(customDirection(editor.customType.directed)).toBeChecked();
    expect(ownTypeName()).toHaveAttribute("aria-expanded", "false");
  });
});

describe("RelationshipEditorDialog create: direction and preview", () => {
  it("P08 shows only the placeholder until both characters and a type are chosen", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await pickParticipant({ name: GERALT.name, slot: editor.participants.source });
    await pickType(copy.types.guardian_of);

    expect(preview()).toHaveTextContent(editor.preview.placeholder);
    expect(preview()).not.toHaveTextContent(GERALT.name);
    expect(
      screen.queryByRole("radiogroup", { name: editor.orientation.legend }),
    ).not.toBeInTheDocument();
  });

  it("R07 names both characters in the direction choice and previews the forward sentence", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await chooseGuardianship();

    const direction = screen.getByRole("radiogroup", { name: editor.orientation.legend });
    expect(direction).toHaveAccessibleDescription(editor.orientation.hint);
    expect(
      within(direction).getByRole("radio", { name: orientationOption(GERALT, CIRI) }),
    ).toBeChecked();
    expect(
      within(direction).getByRole("radio", { name: orientationOption(CIRI, GERALT) }),
    ).not.toBeChecked();
    expect(preview()).toHaveTextContent(
      directedSentence({ source: GERALT, target: CIRI, type: copy.types.guardian_of }),
    );
  });

  it("R08 previews and sends the reversed endpoints with the same type", async () => {
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    await chooseGuardianship();
    await userEvent.click(orientationRadio(CIRI, GERALT));
    expect(preview()).toHaveTextContent(
      directedSentence({ source: CIRI, target: GERALT, type: copy.types.guardian_of }),
    );
    await goToBookStep();
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      expect.objectContaining({
        sourceCharacterId: CIRI.id,
        targetCharacterId: GERALT.id,
        type: "guardian_of",
      }),
    ]);
  });

  it("R06 offers no direction for a symmetric type and previews a mutual sentence", async () => {
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    await chooseBothParticipants();
    await pickType(copy.types.friend_of);
    expect(
      screen.queryByRole("radiogroup", { name: editor.orientation.legend }),
    ).not.toBeInTheDocument();
    expect(preview()).toHaveTextContent(symmetricSentence(GERALT, CIRI));
    await goToBookStep();
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      expect.objectContaining({
        category: "social",
        directionality: "symmetric",
        type: "friend_of",
      }),
    ]);
  });

  it("P11 puts a reversed direction back to forward when another type is chosen", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await chooseGuardianship();
    await userEvent.click(orientationRadio(CIRI, GERALT));
    await pickType(copy.types.ward_of);

    expect(orientationRadio(GERALT, CIRI)).toBeChecked();
  });

  it("P07 R08 lets the page character become the target while it stays fixed", async () => {
    const { onClose } = renderCreate(CREATE_CONTEXTS.characterInBook);

    await pickParticipant({ name: CIRI.name, slot: editor.participants.target });
    await pickType(copy.types.guardian_of);
    await userEvent.click(orientationRadio(CIRI, GERALT));
    expect(screen.getByText(editor.participants.focus)).toBeInTheDocument();
    await goToBookStep();
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      expect.objectContaining({ sourceCharacterId: CIRI.id, targetCharacterId: GERALT.id }),
    ]);
  });

  it("R41 shows no roles and no canonical toggle while creating", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await chooseGuardianship();
    await goToBookStep();

    expect(screen.queryByText(editor.labels.toggle)).not.toBeInTheDocument();
    expect(screen.queryByText(editor.type.canonical)).not.toBeInTheDocument();
  });
});

describe("RelationshipEditorDialog create: changing the book", () => {
  it("R16 R54 asks before dropping the book details and changes nothing while asking", async () => {
    renderCreate(CREATE_CONTEXTS.series);

    await chooseGuardianship();
    await enterDetailsAndReturn();
    await chooseBook(BOOK.title);

    expect(
      await screen.findByRole("alertdialog", { name: editor.book.changeConfirm.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { hidden: true, name: editor.book.label }),
    ).toHaveTextContent(SECOND_BOOK.title);
    expect(
      screen.getByRole("combobox", { hidden: true, name: editor.participants.source }),
    ).toHaveTextContent(GERALT.name);
    expect(
      screen.getByRole("combobox", { hidden: true, name: editor.participants.target }),
    ).toHaveTextContent(CIRI.name);
  });

  it("R16 R54 keeps the whole draft when the author keeps the current book", async () => {
    renderCreate(CREATE_CONTEXTS.series);

    await chooseGuardianship();
    await enterDetailsAndReturn();
    await chooseBook(BOOK.title);
    await userEvent.click(
      await screen.findByRole("button", { name: editor.book.changeConfirm.cancel }),
    );

    expect(combobox(editor.book.label)).toHaveTextContent(SECOND_BOOK.title);
    expect(combobox(editor.participants.target)).toHaveTextContent(CIRI.name);
    await goToBookStep();
    expect(descriptionField()).toHaveValue(CREATE_DESCRIPTION);
  });

  it("R53 clears the free characters, keeps the type and restarts the direction on confirm", async () => {
    renderCreate(CREATE_CONTEXTS.series);

    await chooseGuardianship();
    await userEvent.click(orientationRadio(CIRI, GERALT));
    await enterDetailsAndReturn();
    await chooseBook(BOOK.title);
    await userEvent.click(
      await screen.findByRole("button", { name: editor.book.changeConfirm.confirm }),
    );

    expect(combobox(editor.book.label)).toHaveTextContent(BOOK.title);
    expect(combobox(editor.participants.source)).toHaveTextContent(editor.picker.placeholder);
    expect(combobox(editor.participants.target)).toHaveTextContent(editor.picker.placeholder);
    expect(combobox(editor.type.label)).toHaveTextContent(copy.types.guardian_of);
    expect(preview()).toHaveTextContent(editor.preview.placeholder);
    await chooseBothParticipants();
    expect(orientationRadio(GERALT, CIRI)).toBeChecked();
    expect(rosterPaths()).toEqual([
      `/api/books/${SECOND_BOOK.id}/characters`,
      `/api/books/${BOOK.id}/characters`,
    ]);
  });

  it("R16 R53 starts the new book with default details and collapsed sections", async () => {
    renderCreate(CREATE_CONTEXTS.series);

    await chooseGuardianship();
    await goToBookStep();
    await userEvent.type(descriptionField(), CREATE_DESCRIPTION);
    await userEvent.click(spoilersTrigger());
    await userEvent.click(screen.getByRole("switch", { name: editor.spoilers.type }));
    await goBackToEdgeStep();
    await chooseBook(BOOK.title);
    await userEvent.click(
      await screen.findByRole("button", { name: editor.book.changeConfirm.confirm }),
    );
    await chooseBothParticipants();
    await goToBookStep();

    expect(descriptionField()).toHaveValue("");
    expect(spoilersTrigger()).toHaveAttribute("aria-expanded", "false");
    expect(spoilersTrigger()).toHaveTextContent(editor.spoilers.summaryNone);
  });

  it("R16 P1-3 switches the book straight away once the details are back to defaults", async () => {
    renderCreate(CREATE_CONTEXTS.series);

    await chooseGuardianship();
    await goToBookStep();
    await userEvent.click(spoilersTrigger());
    await userEvent.click(screen.getByRole("switch", { name: editor.spoilers.type }));
    await userEvent.click(screen.getByRole("switch", { name: editor.spoilers.type }));
    await userEvent.type(descriptionField(), CREATE_DESCRIPTION);
    await userEvent.clear(descriptionField());
    await goBackToEdgeStep();
    await chooseBook(BOOK.title);

    await waitFor(() => expect(combobox(editor.book.label)).toHaveTextContent(BOOK.title));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(combobox(editor.participants.source)).toHaveTextContent(editor.picker.placeholder);
  });

  it("R53 keeps the page character when a global character's book changes", async () => {
    renderCreate(CREATE_CONTEXTS.globalCharacter);

    await chooseBook(BOOK.title);
    await pickParticipant({ name: CIRI.name, slot: editor.participants.target });
    await chooseBook(SECOND_BOOK.title);

    expect(screen.getByText(editor.participants.focus)).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: editor.participants.source }),
    ).not.toBeInTheDocument();
    expect(combobox(editor.participants.target)).toHaveTextContent(editor.picker.placeholder);
  });

  it.each([
    { answer: editor.book.changeConfirm.cancel },
    { answer: editor.book.changeConfirm.confirm },
  ])("R16 R54 puts focus back on the book choice after «$answer»", async ({ answer }) => {
    renderCreate(CREATE_CONTEXTS.series);

    await chooseGuardianship();
    await enterDetailsAndReturn();
    await chooseBook(BOOK.title);
    await userEvent.click(await screen.findByRole("button", { name: answer }));

    await waitFor(() => expect(combobox(editor.book.label)).toHaveFocus());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("RelationshipEditorDialog create: save errors", () => {
  it("R13 keeps the author on the first step until both characters and a type are chosen", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await userEvent.click(screen.getByRole("button", { name: editor.actions.next }));

    await waitFor(() => expect(combobox(editor.participants.source)).toHaveFocus());
    expect(combobox(editor.participants.source)).toHaveAccessibleDescription(
      editor.errors.participantRequired,
    );
    expect(combobox(editor.participants.target)).toHaveAccessibleDescription(
      editor.errors.participantRequired,
    );
    expect(combobox(editor.type.label)).toHaveAccessibleDescription(editor.errors.typeRequired);
    expect(screen.queryByRole("button", { name: editor.actions.create })).not.toBeInTheDocument();
    expect(writeRequests()).toEqual([]);
  });

  it("S08 R55 brings an invalid book context back to the pair on the first step", async () => {
    queueCreateReplies(jsonResponse(SERVER_REPLIES.bookContextInvalid, 422));
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    const pair = await submitRejectedDraft();

    const pairError = await within(pair).findByRole("alert");
    await waitFor(() => expect(pairError).toHaveFocus());
    expect(pairError).toHaveTextContent(editor.errors.bookContextInvalid);
    expect(pair).toHaveAccessibleDescription(editor.errors.bookContextInvalid);
    expect(combobox(editor.participants.source)).toHaveTextContent(GERALT.name);
    expect(screen.queryByRole("button", { name: editor.actions.create })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("S08 R55 keeps the series book valid and brings its rejection back to the pair", async () => {
    queueCreateReplies(jsonResponse(SERVER_REPLIES.bookContextInvalid, 422));
    renderCreate(CREATE_CONTEXTS.series);

    const pair = await submitRejectedDraft();

    const pairError = await within(pair).findByRole("alert");
    await waitFor(() => expect(pairError).toHaveFocus());
    expect(pairError).toHaveTextContent(editor.errors.bookContextInvalid);
    expect(combobox(editor.book.label)).toHaveTextContent(SECOND_BOOK.title);
    expect(combobox(editor.book.label)).toHaveAttribute("aria-invalid", "false");
    expect(combobox(editor.book.label)).not.toHaveAccessibleDescription();
  });

  it("R12 S08 brings a self-reference rejected by the server back to the pair", async () => {
    queueCreateReplies(jsonResponse(SERVER_REPLIES.selfReference, 400));
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    const pair = await submitRejectedDraft();

    const pairError = await within(pair).findByRole("alert");
    await waitFor(() => expect(pairError).toHaveFocus());
    expect(pairError).toHaveTextContent(editor.errors.selfReference);
    expect(screen.queryByRole("button", { name: editor.actions.create })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("S08 clears the pair error once the author picks another character", async () => {
    queueCreateReplies(jsonResponse(SERVER_REPLIES.bookContextInvalid, 422));
    renderCreate(CREATE_CONTEXTS.book);

    const pair = await submitRejectedDraft();
    await within(pair).findByRole("alert");
    await pickParticipant({ name: YENNEFER.name, slot: editor.participants.target });

    expect(within(pair).queryByRole("alert")).not.toBeInTheDocument();
    expect(pair).not.toHaveAccessibleDescription();
  });

  it("R11 S08 clears the pair error once the author swaps the characters", async () => {
    queueCreateReplies(jsonResponse(SERVER_REPLIES.bookContextInvalid, 422));
    renderCreate(CREATE_CONTEXTS.book);

    const pair = await submitRejectedDraft();
    await within(pair).findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: editor.participants.swap }));

    expect(within(pair).queryByRole("alert")).not.toBeInTheDocument();
    expect(pair).not.toHaveAccessibleDescription();
  });

  it("P13 marks the visible second card when the server rejects the reversed source", async () => {
    queueCreateReplies(
      jsonResponse(
        { errorsMessages: [{ field: "sourceCharacterId", message: "Not in this book" }] },
        400,
      ),
    );
    renderCreate(CREATE_CONTEXTS.book);

    await chooseGuardianship();
    await userEvent.click(orientationRadio(CIRI, GERALT));
    await goToBookStep();
    await userEvent.click(createButton());

    const secondCard = await screen.findByRole("combobox", { name: editor.participants.target });
    await waitFor(() => expect(secondCard).toHaveFocus());
    expect(secondCard).toHaveAccessibleDescription(editor.errors.invalidValue);
    expect(combobox(editor.participants.source)).toHaveAttribute("aria-invalid", "false");
  });

  it("R25 R57 returns to the type with the edit hint and keeps the draft", async () => {
    queueCreateReplies(jsonResponse(SERVER_REPLIES.duplicate, 409));
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    await chooseGuardianship();
    await goToBookStep();
    await userEvent.type(descriptionField(), CREATE_DESCRIPTION);
    await userEvent.click(createButton());

    await waitFor(() =>
      expect(combobox(editor.type.label)).toHaveAccessibleDescription(
        editor.errors.duplicateCreate,
      ),
    );
    expect(combobox(editor.type.label)).toHaveTextContent(copy.types.guardian_of);
    expect(combobox(editor.participants.target)).toHaveTextContent(CIRI.name);
    expect(createBodies()).toHaveLength(1);
    expect(onClose).not.toHaveBeenCalled();
    await goToBookStep();
    expect(descriptionField()).toHaveValue(CREATE_DESCRIPTION);
  });

  it("R26 P14 re-sends with the family cycle allowed once the author confirms the warning", async () => {
    queueCreateReplies(familyCycleReply({ severity: "warning" }));
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    await chooseGuardianship();
    await goToBookStep();
    await userEvent.click(createButton());
    await userEvent.click(await screen.findByRole("button", { name: editor.familyCycle.confirm }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());

    expect(createBodies()).toEqual([
      expect.objectContaining({ allowFamilyCycle: false }),
      expect.objectContaining({ allowFamilyCycle: true }),
    ]);
  });

  it.each(BLOCKING_FAMILY_CYCLES)(
    "R26 blocks the save with no override when the server reports $reason",
    async ({ details }) => {
      queueCreateReplies(familyCycleReply(details));
      const { onClose } = renderCreate(CREATE_CONTEXTS.book);

      await chooseGuardianship();
      await goToBookStep();
      await userEvent.click(createButton());

      expect(await screen.findByText(editor.familyCycle.blockedTitle)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: editor.familyCycle.confirm }),
      ).not.toBeInTheDocument();
      expect(createBodies()).toHaveLength(1);
      expect(onClose).not.toHaveBeenCalled();
    },
  );

  it("P14 keeps the family warning after a pure swap of the two cards", async () => {
    queueCreateReplies(familyCycleReply({ severity: "warning" }));
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    await chooseGuardianship();
    await goToBookStep();
    await userEvent.click(createButton());
    await screen.findByRole("button", { name: editor.familyCycle.confirm });
    await goBackToEdgeStep();
    await userEvent.click(screen.getByRole("button", { name: editor.participants.swap }));
    await goToBookStep();
    await userEvent.click(screen.getByRole("button", { name: editor.familyCycle.confirm }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());

    expect(createBodies()).toEqual([
      expect.objectContaining({
        allowFamilyCycle: false,
        sourceCharacterId: GERALT.id,
        targetCharacterId: CIRI.id,
      }),
      expect.objectContaining({
        allowFamilyCycle: true,
        sourceCharacterId: GERALT.id,
        targetCharacterId: CIRI.id,
      }),
    ]);
  });

  it("R26 P14 drops the warning and its approval after the direction goes there and back", async () => {
    queueCreateReplies(familyCycleReply({ severity: "warning" }));
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    await chooseGuardianship();
    await goToBookStep();
    await userEvent.click(createButton());
    await screen.findByRole("button", { name: editor.familyCycle.confirm });
    await goBackToEdgeStep();
    await userEvent.click(orientationRadio(CIRI, GERALT));
    await userEvent.click(orientationRadio(GERALT, CIRI));
    await goToBookStep();

    expect(
      screen.queryByRole("button", { name: editor.familyCycle.confirm }),
    ).not.toBeInTheDocument();
    await submitAndWaitForClose(onClose);
    expect(createBodies()).toEqual([
      expect.objectContaining({ allowFamilyCycle: false }),
      expect.objectContaining({
        allowFamilyCycle: false,
        sourceCharacterId: GERALT.id,
        targetCharacterId: CIRI.id,
      }),
    ]);
  });

  it("R27 keeps everything entered when the save fails", async () => {
    queueCreateReplies(jsonResponse(SERVER_REPLIES.serverError, 500));
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    await chooseGuardianship();
    await goToBookStep();
    await userEvent.type(descriptionField(), CREATE_DESCRIPTION);
    await userEvent.click(createButton());
    await waitFor(() => expect(createBodies()).toHaveLength(1));
    await waitFor(() => expect(createButton()).toBeEnabled());

    expect(descriptionField()).toHaveValue(CREATE_DESCRIPTION);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("R27 R42 sends the same relationship again when the author retries a failed save", async () => {
    queueCreateReplies(jsonResponse(SERVER_REPLIES.serverError, 500));
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    await chooseGuardianship();
    await goToBookStep();
    await userEvent.type(descriptionField(), CREATE_DESCRIPTION);
    await userEvent.click(createButton());
    await waitFor(() => expect(createBodies()).toHaveLength(1));
    await waitFor(() => expect(createButton()).toBeEnabled());
    await submitAndWaitForClose(onClose);

    const [failed, retried] = createBodies();
    expect(retried).toEqual(failed);
  });

  it("R30 sends a single POST while the save is pending", async () => {
    let finishSave: (response: Response) => void = () => undefined;
    queueCreateReplies(
      new Promise<Response>((resolve) => {
        finishSave = resolve;
      }),
    );
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    await chooseGuardianship();
    await goToBookStep();
    await userEvent.click(createButton());
    await waitFor(() => expect(createButton()).toBeDisabled());
    await userEvent.click(createButton());
    finishSave(jsonResponse(makeEditableRelationship(), 201));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());

    expect(createBodies()).toHaveLength(1);
  });

  it("R30 sends a single POST when the author double-clicks Create", async () => {
    const { onClose } = renderCreate(CREATE_CONTEXTS.book);

    await chooseGuardianship();
    await goToBookStep();
    await userEvent.dblClick(createButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());

    expect(createBodies()).toHaveLength(1);
  });
});

describe("RelationshipEditorDialog create: keyboard", () => {
  it("R32 picks a type with the keyboard alone", async () => {
    renderCreate(CREATE_CONTEXTS.characterInBook);

    await pickParticipant({ name: CIRI.name, slot: editor.participants.target });
    await waitFor(() => expect(combobox(editor.participants.target)).toHaveFocus());
    await userEvent.tab();
    expect(combobox(editor.type.label)).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(combobox(editor.type.search)).toHaveFocus());
    await userEvent.keyboard(TYPED_TEXT.typeSearch);
    await screen.findByRole("option", { name: copy.types.hunts, selected: true });
    await userEvent.keyboard("{ArrowDown}");
    await screen.findByRole("option", { name: copy.types.hunted_by, selected: true });
    await userEvent.keyboard("{Enter}");

    expect(combobox(editor.type.label)).toHaveTextContent(copy.types.hunted_by);
    expect(screen.queryByRole("listbox", { name: editor.type.results })).not.toBeInTheDocument();
    await waitFor(() => expect(combobox(editor.type.label)).toHaveFocus());
  });

  it("R32 opens the own type suggestions with ArrowDown and applies the typed name with Enter", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await startOwnType();
    await waitFor(() => expect(ownTypeName()).toHaveFocus());
    await userEvent.keyboard("{ArrowDown}");
    await screen.findByRole("listbox", { name: editor.customType.suggestions });
    await userEvent.keyboard("{Escape}");
    expect(
      screen.queryByRole("listbox", { name: editor.customType.suggestions }),
    ).not.toBeInTheDocument();
    await userEvent.keyboard(TYPED_TEXT.ownType.typed);
    await screen.findByRole("option", { name: typedNameOption(TYPED_TEXT.ownType.collapsed) });
    await userEvent.keyboard("{Escape}");
    expect(ownTypeName()).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{ArrowDown}");
    await screen.findByRole("option", {
      name: typedNameOption(TYPED_TEXT.ownType.collapsed),
      selected: true,
    });
    await userEvent.keyboard("{Enter}");

    expect(ownTypeName()).toHaveValue(TYPED_TEXT.ownType.collapsed);
    expect(ownTypeName()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("dialog", { name: editor.createTitle })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: editor.actions.create })).not.toBeInTheDocument();
  });

  it("R32 re-sends a failed character search with Enter on the highlighted Retry option", async () => {
    queueRosterReplies(jsonResponse(SERVER_REPLIES.serverError, 500));
    renderCreate(CREATE_CONTEXTS.book);

    await userEvent.click(combobox(editor.participants.source));
    await screen.findByRole("option", { name: messages.common.retry, selected: true });
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByRole("option", { name: endingWith(CIRI.name) })).toBeInTheDocument();
    expect(
      getRequests().filter((url) => url.pathname === `/api/books/${BOOK.id}/characters`),
    ).toHaveLength(2);
  });

  it("R32 R29 focuses the first character picker on Back in a fixed book", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await chooseGuardianship();
    await goToBookStep();
    await goBackToEdgeStep();

    await waitFor(() => expect(combobox(editor.participants.source)).toHaveFocus());
  });

  it("R32 R29 skips the page character and focuses the other picker on Back", async () => {
    renderCreate(CREATE_CONTEXTS.characterInBook);

    await pickParticipant({ name: CIRI.name, slot: editor.participants.target });
    await pickType(copy.types.guardian_of);
    await goToBookStep();
    await goBackToEdgeStep();

    await waitFor(() => expect(combobox(editor.participants.target)).toHaveFocus());
  });

  it("R32 R29 focuses the book choice on Back when the author picks the book", async () => {
    renderCreate(CREATE_CONTEXTS.series);

    await chooseGuardianship();
    await goToBookStep();
    await goBackToEdgeStep();

    await waitFor(() => expect(combobox(editor.book.label)).toHaveFocus());
  });

  it("R32 S08 lands on the second step heading named with the step and the book", async () => {
    renderCreate(CREATE_CONTEXTS.book);

    await chooseGuardianship();
    await userEvent.click(screen.getByRole("button", { name: editor.actions.next }));

    const heading = await screen.findByRole("heading", {
      name: `${editor.steps.bookHeading} ${BOOK.title}`,
    });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it.each([
    { section: editor.positions.section, trigger: positionsTrigger },
    { section: editor.spoilers.section, trigger: spoilersTrigger },
  ])("R32 opens and closes «$section» with Enter and Space", async ({ trigger }) => {
    renderCreate(CREATE_CONTEXTS.book);

    await chooseGuardianship();
    await goToBookStep();
    await act(async () => {
      trigger().focus();
    });
    await userEvent.keyboard("{Enter}");
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard(" ");

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });
});
