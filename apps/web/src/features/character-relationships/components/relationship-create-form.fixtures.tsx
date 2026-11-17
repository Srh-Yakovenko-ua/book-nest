import { expect, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import type { RelationshipAuthoringContext } from "../model/relationship-authoring";
import type { RelationshipParticipant } from "../model/relationship-form-schema";

import {
  makeCharacterPage,
  makeEditableRelationship,
  makeRosterCharacter,
  RELATIONSHIP_FIXTURE,
} from "../model/relationships.fixtures";
import { RelationshipEditorDialog } from "./relationship-editor-dialog";

type CreateReply = Promise<Response> | Response;

const editor = messages.relationships.editor;

const SERIES_ID = "5a5a5a5a-0000-4000-8000-000000000003";

export const CREATE_API = {
  customTypes: "/api/character-relationship-custom-types",
  relationships: "/api/character-relationships",
} as const;

export const CREATE_BOOKS = {
  first: RELATIONSHIP_FIXTURE.book,
  second: RELATIONSHIP_FIXTURE.secondBook,
} as const;

export const CREATE_PEOPLE = {
  ciri: { avatarUrl: null, ...RELATIONSHIP_FIXTURE.ciri },
  geralt: { avatarUrl: null, ...RELATIONSHIP_FIXTURE.geralt },
  yennefer: { avatarUrl: null, ...RELATIONSHIP_FIXTURE.yennefer },
} as const satisfies Record<string, RelationshipParticipant>;

export const CREATE_CONTEXTS = {
  book: {
    bookOptions: [CREATE_BOOKS.first],
    scope: { bookId: CREATE_BOOKS.first.id, kind: "book" },
  },
  characterInBook: {
    bookOptions: [CREATE_BOOKS.first],
    focusCharacter: CREATE_PEOPLE.geralt,
    scope: {
      characterId: CREATE_PEOPLE.geralt.id,
      contextBookId: CREATE_BOOKS.first.id,
      kind: "character",
    },
  },
  globalCharacter: {
    bookOptions: [CREATE_BOOKS.first, CREATE_BOOKS.second],
    focusCharacter: CREATE_PEOPLE.geralt,
    scope: { characterId: CREATE_PEOPLE.geralt.id, contextBookId: null, kind: "character" },
  },
  globalCharacterWithOneBook: {
    bookOptions: [CREATE_BOOKS.first],
    focusCharacter: CREATE_PEOPLE.geralt,
    scope: { characterId: CREATE_PEOPLE.geralt.id, contextBookId: null, kind: "character" },
  },
  globalCharacterWithoutBooks: {
    bookOptions: [],
    focusCharacter: CREATE_PEOPLE.geralt,
    scope: { characterId: CREATE_PEOPLE.geralt.id, contextBookId: null, kind: "character" },
  },
  series: {
    bookOptions: [CREATE_BOOKS.first, CREATE_BOOKS.second],
    scope: { contextBookId: CREATE_BOOKS.second.id, kind: "series", seriesId: SERIES_ID },
  },
  seriesWithoutBooks: {
    bookOptions: [],
    scope: { contextBookId: null, kind: "series", seriesId: SERIES_ID },
  },
  seriesWithoutContext: {
    bookOptions: [CREATE_BOOKS.first, CREATE_BOOKS.second],
    scope: { contextBookId: null, kind: "series", seriesId: SERIES_ID },
  },
} as const satisfies Record<string, RelationshipAuthoringContext>;

export const CREATE_DEFAULT_BOOK_STATE = {
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

export const CREATE_DESCRIPTION = "Ґеральт забирає Цірі з Цинтри.";

export const HIDDEN_STEP_CONTENT = "[hidden] *, script, style";

const createApi = {
  createReplies: new Array<CreateReply>(),
  customTypes: (): Response => jsonResponse(makeCharacterPage([])),
  fetchMock: vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(),
  rosterReplies: new Array<Response>(),
};

export async function chooseGuardianship() {
  await pickParticipant({ name: CREATE_PEOPLE.geralt.name, slot: editor.participants.source });
  await pickParticipant({ name: CREATE_PEOPLE.ciri.name, slot: editor.participants.target });
  await pickType(messages.relationships.types.guardian_of);
}

export function combobox(name: string): HTMLElement {
  return screen.getByRole("combobox", { name });
}

export function createBodies(): unknown[] {
  return createApi.fetchMock.mock.calls.flatMap(([input, init]) => {
    const url = new URL(String(input), "http://localhost");
    if (init?.method !== "POST" || url.pathname !== CREATE_API.relationships) return [];
    const body: unknown = JSON.parse(String(init.body));
    return [body];
  });
}

export function createButton(): HTMLElement {
  return screen.getByRole("button", { name: editor.actions.create });
}

export function descriptionField(): HTMLElement {
  return screen.getByRole("textbox", {
    name: `${editor.state.description} ${editor.state.optional}`,
  });
}

export function directedSentence({
  source,
  target,
  type,
}: {
  source: RelationshipParticipant;
  target: RelationshipParticipant;
  type: string;
}): string {
  return editor.preview.directed
    .replace("{source}", source.name)
    .replace("{type}", type)
    .replace("{target}", target.name);
}

export function endingWith(text: string): RegExp {
  return new RegExp(`${text}$`);
}

export function getRequests(): URL[] {
  return createApi.fetchMock.mock.calls
    .filter(([, init]) => (init?.method ?? "GET").toUpperCase() === "GET")
    .map(([input]) => new URL(String(input), "http://localhost"));
}

export async function goBackToEdgeStep() {
  await userEvent.click(screen.getByRole("button", { name: editor.actions.back }));
  await screen.findByRole("button", { name: editor.actions.next });
}

export async function goToBookStep() {
  await userEvent.click(screen.getByRole("button", { name: editor.actions.next }));
  await screen.findByRole("button", { name: editor.actions.create });
}

export function installCreateApi() {
  Element.prototype.scrollIntoView = vi.fn();
  createApi.createReplies = [];
  createApi.customTypes = () => jsonResponse(makeCharacterPage([]));
  createApi.rosterReplies = [];
  createApi.fetchMock.mockReset();
  createApi.fetchMock.mockImplementation(respond);
  vi.stubGlobal("fetch", createApi.fetchMock);
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

export function orientationOption(
  source: RelationshipParticipant,
  target: RelationshipParticipant,
): string {
  return editor.orientation.option
    .replace("{source}", source.name)
    .replace("{target}", target.name);
}

export async function pickParticipant({ name, slot }: { name: string; slot: string }) {
  await userEvent.click(combobox(slot));
  await userEvent.click(await screen.findByRole("option", { name: endingWith(name) }));
}

export async function pickType(label: string) {
  await userEvent.click(combobox(editor.type.label));
  await userEvent.type(screen.getByPlaceholderText(editor.type.search), label);
  await userEvent.click(await screen.findByRole("option", { name: label }));
}

export function positionsTrigger(): HTMLElement {
  return screen.getByRole("button", { name: editor.positions.section });
}

export function queueCreateReplies(...replies: CreateReply[]) {
  createApi.createReplies.push(...replies);
}

export function queueRosterReplies(...replies: Response[]) {
  createApi.rosterReplies.push(...replies);
}

export function renderCreate(context: RelationshipAuthoringContext) {
  const onClose = vi.fn<() => void>();
  renderWithProviders(
    <RelationshipEditorDialog {...context} onClose={onClose} open target={{ mode: "create" }} />,
  );
  return { onClose };
}

export function respondToCustomTypes(reply: () => Response) {
  createApi.customTypes = reply;
}

export function spoilersTrigger(): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`^${editor.spoilers.section}`) });
}

export async function submitAndWaitForClose(onClose: () => void) {
  await userEvent.click(createButton());
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
}

export function writeRequests(): string[] {
  return createApi.fetchMock.mock.calls.flatMap(([input, init]) => {
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET") return [];
    return [`${method} ${new URL(String(input), "http://localhost").pathname}`];
  });
}

function isRosterPath(pathname: string): boolean {
  return /^\/api\/books\/[^/]+\/characters$/.test(pathname);
}

function respond(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input), "http://localhost");
  const method = (init?.method ?? "GET").toUpperCase();
  if (method === "GET" && url.pathname === CREATE_API.customTypes) {
    return Promise.resolve(createApi.customTypes());
  }
  if (method === "GET" && isRosterPath(url.pathname)) {
    const roster = [CREATE_PEOPLE.geralt, CREATE_PEOPLE.ciri, CREATE_PEOPLE.yennefer];
    return Promise.resolve(
      createApi.rosterReplies.shift() ??
        jsonResponse(makeCharacterPage(roster.map(makeRosterCharacter))),
    );
  }
  if (method === "POST" && url.pathname === CREATE_API.relationships) {
    return Promise.resolve(
      createApi.createReplies.shift() ?? jsonResponse(makeEditableRelationship(), 201),
    );
  }
  return Promise.reject(new Error(`unexpected ${method} ${url.pathname}`));
}
