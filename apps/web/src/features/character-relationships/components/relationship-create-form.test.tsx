import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import type { RelationshipBookOption } from "../model/relationship-adapter";
import type { RelationshipAuthoringContext } from "../model/relationship-authoring";
import type { RelationshipParticipant } from "../model/relationship-form-schema";

import {
  makeCharacterPage,
  makeEditableRelationship,
  makeGlobalCharacter,
  makeRosterCharacter,
  RELATIONSHIP_FIXTURE,
} from "../model/relationships.fixtures";
import { RelationshipEditorDialog } from "./relationship-editor-dialog";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const copy = messages.relationships;
const editor = copy.editor;

const BOOK = RELATIONSHIP_FIXTURE.book;
const SECOND_BOOK = RELATIONSHIP_FIXTURE.secondBook;
const BOOK_OPTIONS: readonly RelationshipBookOption[] = [BOOK, SECOND_BOOK];

const GERALT: RelationshipParticipant = { avatarUrl: null, ...RELATIONSHIP_FIXTURE.geralt };
const CIRI: RelationshipParticipant = { avatarUrl: null, ...RELATIONSHIP_FIXTURE.ciri };
const YENNEFER: RelationshipParticipant = { avatarUrl: null, ...RELATIONSHIP_FIXTURE.yennefer };

const CHARACTERS: readonly RelationshipParticipant[] = [GERALT, CIRI, YENNEFER];

const DESCRIPTION = "Ґеральт забирає Цірі з Цинтри.";

const CREATE_PATH = "/api/character-relationships";
const CHARACTERS_PATH = "/api/characters";

const CONTEXTS = {
  book: { bookOptions: [BOOK], scope: { bookId: BOOK.id, kind: "book" } },
  characterInBook: {
    bookOptions: [BOOK],
    focusCharacter: GERALT,
    scope: { characterId: GERALT.id, contextBookId: BOOK.id, kind: "character" },
  },
  globalCharacter: {
    bookOptions: BOOK_OPTIONS,
    focusCharacter: GERALT,
    scope: { characterId: GERALT.id, contextBookId: null, kind: "character" },
  },
  series: {
    bookOptions: BOOK_OPTIONS,
    scope: {
      contextBookId: SECOND_BOOK.id,
      kind: "series",
      seriesId: "5a5a5a5a-0000-4000-8000-000000000003",
    },
  },
} as const satisfies Record<string, RelationshipAuthoringContext>;

const EMPTY_BOOK_STATE = {
  description: null,
  endedAudioSeconds: null,
  endedChapter: null,
  endedPage: null,
  hideRelationshipAsSpoiler: false,
  intensity: null,
  introducedAudioSeconds: null,
  introducedChapter: null,
  introducedPage: null,
  isDescriptionSpoiler: false,
  isTypeSpoiler: false,
  status: "active",
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

const BLOCKING_FAMILY_CYCLES = [
  { details: { severity: "conflict" }, reason: "a conflict" },
  { details: undefined, reason: "no severity" },
] as const;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let createReplies: Response[];

async function chooseGuardianship() {
  await pickParticipant({ name: GERALT.name, slot: editor.participants.source });
  await pickParticipant({ name: CIRI.name, slot: editor.participants.target });
  await pickType(copy.types.guardian_of);
}

function combobox(name: string): HTMLElement {
  return screen.getByRole("combobox", { name });
}

function createBodies(): unknown[] {
  return fetchMock.mock.calls.flatMap(([input, init]) => {
    const url = new URL(String(input), "http://localhost");
    if (init?.method !== "POST" || url.pathname !== CREATE_PATH) return [];
    const body: unknown = JSON.parse(String(init.body));
    return [body];
  });
}

function createButton(): HTMLElement {
  return screen.getByRole("button", { name: editor.actions.create });
}

function customTypeField(): HTMLElement {
  return screen.getByRole("textbox", { name: editor.type.customLabel });
}

function descriptionField(): HTMLElement {
  return screen.getByRole("textbox", { name: editor.state.description });
}

function endingWith(text: string): RegExp {
  return new RegExp(`${text}$`);
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

async function goToBookStep() {
  await userEvent.click(screen.getByRole("button", { name: editor.actions.next }));
  await screen.findByRole("button", { name: editor.actions.create });
}

function isRosterPath(pathname: string): boolean {
  return pathname.startsWith("/api/books/") && pathname.endsWith("/characters");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

async function pickCategory(category: string) {
  await userEvent.click(
    within(screen.getByRole("radiogroup", { name: editor.type.category })).getByRole("radio", {
      name: category,
    }),
  );
}

async function pickParticipant({ name, slot }: { name: string; slot: string }) {
  await userEvent.click(combobox(slot));
  await userEvent.click(await screen.findByRole("option", { name: endingWith(name) }));
}

async function pickType(type: string) {
  await userEvent.click(combobox(editor.type.label));
  await userEvent.click(await screen.findByRole("option", { name: new RegExp(`^${type}`) }));
}

function renderCreate(context: RelationshipAuthoringContext) {
  const onClose = vi.fn<() => void>();
  renderWithProviders(
    <RelationshipEditorDialog {...context} onClose={onClose} open target={{ mode: "create" }} />,
  );
  return { onClose };
}

function roleLabel(name: string): string {
  return editor.labels.source.replace("{name}", name);
}

async function submitAndWaitForClose(onClose: () => void) {
  await userEvent.click(createButton());
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  createReplies = [];

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET" && url.pathname === CHARACTERS_PATH) {
      return Promise.resolve(jsonResponse(makeCharacterPage(CHARACTERS.map(makeGlobalCharacter))));
    }
    if (method === "GET" && isRosterPath(url.pathname)) {
      return Promise.resolve(jsonResponse(makeCharacterPage(CHARACTERS.map(makeRosterCharacter))));
    }
    if (method === "POST" && url.pathname === CREATE_PATH) {
      return Promise.resolve(
        createReplies.shift() ?? jsonResponse(makeEditableRelationship(), 201),
      );
    }
    return Promise.reject(new Error(`unexpected ${method} ${url.pathname}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("RelationshipEditorDialog create: steps", () => {
  it("creates the edge and the current book's details in one POST after both steps", async () => {
    const { onClose } = renderCreate(CONTEXTS.book);

    await chooseGuardianship();
    await goToBookStep();
    expect(screen.getByText(BOOK.title)).toBeInTheDocument();
    await userEvent.type(descriptionField(), DESCRIPTION);
    expect(createBodies()).toEqual([]);
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      {
        allowFamilyCycle: false,
        category: "family",
        customType: null,
        directionality: "directed",
        initialBookStates: [{ ...EMPTY_BOOK_STATE, bookId: BOOK.id, description: DESCRIPTION }],
        isCanonical: false,
        sourceCharacterId: GERALT.id,
        sourceLabel: null,
        targetCharacterId: CIRI.id,
        targetLabel: null,
        type: "guardian_of",
      },
    ]);
  });

  it("keeps the author on the first step until both characters and a type are chosen", async () => {
    renderCreate(CONTEXTS.book);

    await userEvent.click(screen.getByRole("button", { name: editor.actions.next }));

    await waitFor(() =>
      expect(combobox(editor.type.label)).toHaveAccessibleDescription(editor.errors.typeRequired),
    );
    expect(combobox(editor.participants.source)).toHaveAccessibleDescription(
      editor.errors.participantRequired,
    );
    expect(combobox(editor.participants.target)).toHaveAccessibleDescription(
      editor.errors.participantRequired,
    );
    expect(screen.queryByRole("button", { name: editor.actions.create })).not.toBeInTheDocument();
  });

  it("lets the global character view skip the book and sends no book details", async () => {
    const { onClose } = renderCreate(CONTEXTS.globalCharacter);

    await pickParticipant({ name: CIRI.name, slot: editor.participants.target });
    await pickType(copy.types.guardian_of);
    await goToBookStep();
    expect(combobox(editor.book.label)).toHaveTextContent(editor.book.none);
    expect(screen.getByText(editor.book.skipHint)).toBeInTheDocument();
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      expect.objectContaining({
        initialBookStates: [],
        sourceCharacterId: GERALT.id,
        targetCharacterId: CIRI.id,
      }),
    ]);
  });

  it("preselects the series book the reader is in", async () => {
    const { onClose } = renderCreate(CONTEXTS.series);

    await chooseGuardianship();
    await goToBookStep();
    expect(combobox(editor.book.label)).toHaveTextContent(SECOND_BOOK.title);
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      expect.objectContaining({
        initialBookStates: [expect.objectContaining({ bookId: SECOND_BOOK.id })],
      }),
    ]);
  });

  it("saves the details for another series book the author picks", async () => {
    const { onClose } = renderCreate(CONTEXTS.series);

    await chooseGuardianship();
    await goToBookStep();
    await userEvent.click(combobox(editor.book.label));
    await userEvent.click(await screen.findByRole("option", { name: BOOK.title }));
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      expect.objectContaining({
        initialBookStates: [expect.objectContaining({ bookId: BOOK.id })],
      }),
    ]);
  });
});

describe("RelationshipEditorDialog create: participants", () => {
  it("swaps the two characters together with their roles", async () => {
    const { onClose } = renderCreate(CONTEXTS.book);

    await chooseGuardianship();
    await userEvent.click(screen.getByRole("button", { name: editor.labels.toggle }));
    await userEvent.type(screen.getByRole("textbox", { name: roleLabel(GERALT.name) }), "опікун");
    await userEvent.type(screen.getByRole("textbox", { name: roleLabel(CIRI.name) }), "підопічна");
    await userEvent.click(screen.getByRole("button", { name: editor.participants.swap }));
    expect(combobox(editor.participants.source)).toHaveTextContent(CIRI.name);
    expect(combobox(editor.participants.target)).toHaveTextContent(GERALT.name);
    await goToBookStep();
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      expect.objectContaining({
        sourceCharacterId: CIRI.id,
        sourceLabel: "підопічна",
        targetCharacterId: GERALT.id,
        targetLabel: "опікун",
      }),
    ]);
  });

  it("never offers the character whose page this is as the other participant", async () => {
    renderCreate(CONTEXTS.characterInBook);

    expect(screen.getByText(editor.participants.focus)).toBeInTheDocument();
    await userEvent.click(combobox(editor.participants.target));

    expect(await screen.findByRole("option", { name: endingWith(CIRI.name) })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: endingWith(YENNEFER.name) })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: endingWith(GERALT.name) })).not.toBeInTheDocument();
  });

  it("does not offer the character already chosen on the other side", async () => {
    renderCreate(CONTEXTS.book);

    await pickParticipant({ name: CIRI.name, slot: editor.participants.source });
    await userEvent.click(combobox(editor.participants.target));

    expect(
      await screen.findByRole("option", { name: endingWith(GERALT.name) }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: endingWith(CIRI.name) })).not.toBeInTheDocument();
  });
});

describe("RelationshipEditorDialog create: type and direction", () => {
  it("takes the direction of a catalog type from the catalog and offers no choice", async () => {
    const { onClose } = renderCreate(CONTEXTS.book);

    await chooseGuardianship();
    expect(screen.getByText(copy.directionality.directed)).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: editor.type.directionality }),
    ).not.toBeInTheDocument();
    await goToBookStep();
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      expect.objectContaining({ directionality: "directed", type: "guardian_of" }),
    ]);
  });

  it("lets a custom type choose its direction and sends the name with it", async () => {
    const { onClose } = renderCreate(CONTEXTS.book);

    await pickParticipant({ name: GERALT.name, slot: editor.participants.source });
    await pickParticipant({ name: CIRI.name, slot: editor.participants.target });
    await pickCategory(copy.categories.custom);
    await userEvent.type(customTypeField(), "побратими");
    await userEvent.click(
      within(screen.getByRole("radiogroup", { name: editor.type.directionality })).getByRole(
        "radio",
        { name: copy.directionality.directed },
      ),
    );
    await goToBookStep();
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      expect.objectContaining({
        category: "custom",
        customType: "побратими",
        directionality: "directed",
        type: "custom",
      }),
    ]);
  });

  it("asks for the name of a custom type before moving on", async () => {
    renderCreate(CONTEXTS.book);

    await pickParticipant({ name: GERALT.name, slot: editor.participants.source });
    await pickParticipant({ name: CIRI.name, slot: editor.participants.target });
    await pickCategory(copy.categories.custom);
    await userEvent.click(screen.getByRole("button", { name: editor.actions.next }));

    await waitFor(() =>
      expect(customTypeField()).toHaveAccessibleDescription(editor.errors.customTypeRequired),
    );
    expect(screen.queryByRole("button", { name: editor.actions.create })).not.toBeInTheDocument();
  });
});

describe("RelationshipEditorDialog create: spoilers", () => {
  it.each(SPOILER_TOGGLES)("sends «$label» as its own flag", async ({ expected, label }) => {
    const { onClose } = renderCreate(CONTEXTS.book);

    await chooseGuardianship();
    await goToBookStep();
    await userEvent.click(screen.getByRole("switch", { name: label }));
    await submitAndWaitForClose(onClose);

    expect(createBodies()).toEqual([
      expect.objectContaining({ initialBookStates: [expect.objectContaining(expected)] }),
    ]);
  });
});

describe("RelationshipEditorDialog create: server errors", () => {
  it("points at the type when the relationship already exists", async () => {
    createReplies = [
      jsonResponse(
        { code: "relationship_duplicate", message: "This relationship already exists" },
        409,
      ),
    ];
    const { onClose } = renderCreate(CONTEXTS.book);

    await chooseGuardianship();
    await goToBookStep();
    await userEvent.click(createButton());

    await waitFor(() =>
      expect(combobox(editor.type.label)).toHaveAccessibleDescription(editor.errors.duplicate),
    );
    expect(combobox(editor.type.label)).toHaveTextContent(copy.types.guardian_of);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("re-sends with the family cycle allowed once the author confirms the warning", async () => {
    createReplies = [familyCycleReply({ severity: "warning" })];
    const { onClose } = renderCreate(CONTEXTS.book);

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
    "blocks the save with no override when the server reports $reason",
    async ({ details }) => {
      createReplies = [familyCycleReply(details)];
      const { onClose } = renderCreate(CONTEXTS.book);

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

  it("keeps everything entered when the save fails", async () => {
    createReplies = [jsonResponse({ message: "Internal server error" }, 500)];
    const { onClose } = renderCreate(CONTEXTS.book);

    await chooseGuardianship();
    await goToBookStep();
    await userEvent.type(descriptionField(), DESCRIPTION);
    await userEvent.click(createButton());
    await waitFor(() => expect(createBodies()).toHaveLength(1));
    await waitFor(() => expect(createButton()).toBeEnabled());

    expect(descriptionField()).toHaveValue(DESCRIPTION);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("sends the same relationship again when the author retries a failed save", async () => {
    createReplies = [jsonResponse({ message: "Internal server error" }, 500)];
    const { onClose } = renderCreate(CONTEXTS.book);

    await chooseGuardianship();
    await goToBookStep();
    await userEvent.type(descriptionField(), DESCRIPTION);
    await userEvent.click(createButton());
    await waitFor(() => expect(createBodies()).toHaveLength(1));
    await waitFor(() => expect(createButton()).toBeEnabled());
    await submitAndWaitForClose(onClose);

    const [failed, retried] = createBodies();
    expect(retried).toEqual(failed);
  });
});
