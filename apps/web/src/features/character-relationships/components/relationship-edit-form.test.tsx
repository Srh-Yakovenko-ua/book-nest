import "@testing-library/jest-dom/vitest";

import type { CharacterRelationshipDetailsView, UpdateCharacterRelationship } from "@app/shared";
import type { ReactNode } from "react";

import { UpdateCharacterRelationshipSchema } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import type { RelationshipScope } from "../model/relationship-scope";

import {
  makeEditableBookState,
  makeEditableRelationship,
  RELATIONSHIP_FIXTURE,
} from "../model/relationships.fixtures";
import { RelationshipEditorDialog } from "./relationship-editor-dialog";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

type WriteRequest = { body: unknown; method: string; path: string };

const copy = messages.relationships;
const editor = copy.editor;

const BOOK = RELATIONSHIP_FIXTURE.book;
const RELATIONSHIP_ID = RELATIONSHIP_FIXTURE.relationshipId;

const BOOK_SCOPE: Extract<RelationshipScope, { kind: "book" }> = {
  bookId: BOOK.id,
  kind: "book",
};

const PATHS = {
  bookState: `/api/character-relationships/${RELATIONSHIP_ID}/books/${BOOK.id}`,
  editable: `/api/character-relationships/${RELATIONSHIP_ID}/edit`,
  relationship: `/api/character-relationships/${RELATIONSHIP_ID}`,
} as const;

const STORED_STATE = makeEditableBookState({
  introducedAudioSeconds: 3930,
  introducedChapter: "Розділ 3",
  isTypeSpoiler: true,
});

const NEW_DESCRIPTION = "Ґеральт знаходить Цірі в Брокілоні.";

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let failingUpserts: number;
let stored: CharacterRelationshipDetailsView;

function applyUpdate({
  current,
  update,
}: {
  current: CharacterRelationshipDetailsView;
  update: UpdateCharacterRelationship;
}): CharacterRelationshipDetailsView {
  return {
    ...current,
    category: update.category ?? current.category,
    customType: update.customType === undefined ? current.customType : update.customType,
    isCanonical: update.isCanonical ?? current.isCanonical,
    sourceLabel: update.sourceLabel === undefined ? current.sourceLabel : update.sourceLabel,
    targetLabel: update.targetLabel === undefined ? current.targetLabel : update.targetLabel,
    type: update.type ?? current.type,
  };
}

function canonicalSwitch(): HTMLElement {
  return screen.getByRole("switch", { name: editor.type.canonical });
}

function descriptionField(): HTMLElement {
  return screen.getByRole("textbox", { name: editor.state.description });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function readBody(init: RequestInit | undefined): unknown {
  const body: unknown = init?.body === undefined ? undefined : JSON.parse(String(init.body));
  return body;
}

function renderEditor() {
  const onClose = vi.fn<() => void>();
  renderWithProviders(
    <RelationshipEditorDialog
      bookOptions={[BOOK]}
      onClose={onClose}
      open
      scope={BOOK_SCOPE}
      target={{ mode: "edit", relationshipId: RELATIONSHIP_ID }}
    />,
  );
  return { onClose };
}

async function rewriteDescription() {
  const field = await screen.findByRole("textbox", { name: editor.state.description });
  await userEvent.clear(field);
  await userEvent.type(field, NEW_DESCRIPTION);
}

function saveButton(): HTMLElement {
  return screen.getByRole("button", { name: editor.actions.save });
}

async function saveCanonicalAndDescriptionWithFailingBookState() {
  failingUpserts = 1;
  renderEditor();
  await rewriteDescription();
  await userEvent.click(canonicalSwitch());
  await userEvent.click(saveButton());
  await waitFor(() => expect(writeMethods()).toEqual(["PATCH", "PUT"]));
  await waitFor(() => expect(saveButton()).toBeEnabled());
}

function writeMethods(): string[] {
  return writeRequests().map((request) => request.method);
}

function writeRequests(): WriteRequest[] {
  return fetchMock.mock.calls.flatMap(([input, init]) => {
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET") return [];
    const { pathname } = new URL(String(input), "http://localhost");
    return [{ body: readBody(init), method, path: pathname }];
  });
}

beforeEach(() => {
  failingUpserts = 0;
  stored = makeEditableRelationship({ bookStates: [STORED_STATE] });

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const { pathname } = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET" && pathname === PATHS.editable) {
      return Promise.resolve(jsonResponse(stored));
    }
    if (method === "PATCH" && pathname === PATHS.relationship) {
      stored = applyUpdate({
        current: stored,
        update: UpdateCharacterRelationshipSchema.parse(readBody(init)),
      });
      return Promise.resolve(jsonResponse(stored));
    }
    if (method === "PUT" && pathname === PATHS.bookState) {
      if (failingUpserts > 0) {
        failingUpserts -= 1;
        return Promise.resolve(jsonResponse({ message: "Internal server error" }, 500));
      }
      return Promise.resolve(jsonResponse(stored));
    }
    return Promise.reject(new Error(`unexpected ${method} ${pathname}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("RelationshipEditorDialog edit: fields", () => {
  it("shows who is connected with no control to change them or the direction", async () => {
    stored = makeEditableRelationship({
      category: "custom",
      customType: "побратими",
      directionality: "directed",
      type: "custom",
    });
    renderEditor();

    expect(await screen.findByRole("textbox", { name: editor.type.customLabel })).toHaveValue(
      "побратими",
    );
    expect(screen.getByText(RELATIONSHIP_FIXTURE.geralt.name)).toBeInTheDocument();
    expect(screen.getByText(RELATIONSHIP_FIXTURE.ciri.name)).toBeInTheDocument();
    expect(screen.getByText(editor.participants.locked)).toBeInTheDocument();
    expect(screen.getByText(editor.type.directionalityLocked)).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: editor.participants.source }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: editor.participants.target }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: editor.participants.swap }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: editor.type.directionality }),
    ).not.toBeInTheDocument();
  });

  it("offers nothing to save until something changed", async () => {
    renderEditor();

    await screen.findByRole("textbox", { name: editor.state.description });

    expect(saveButton()).toBeDisabled();
  });
});

describe("RelationshipEditorDialog edit: saving", () => {
  it("sends only the book PUT, keeping the stored details, for a book-only change", async () => {
    const { onClose } = renderEditor();

    await rewriteDescription();
    await userEvent.click(saveButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());

    expect(writeRequests()).toEqual([
      {
        body: {
          description: NEW_DESCRIPTION,
          endedAudioSeconds: null,
          endedChapter: null,
          endedPage: null,
          hideRelationshipAsSpoiler: false,
          intensity: "medium",
          introducedAudioSeconds: 3930,
          introducedChapter: "Розділ 3",
          introducedPage: null,
          isDescriptionSpoiler: false,
          isTypeSpoiler: true,
          status: "active",
        },
        method: "PUT",
        path: PATHS.bookState,
      },
    ]);
  });

  it("sends only the PATCH when only the relationship itself changed", async () => {
    const { onClose } = renderEditor();

    await screen.findByRole("textbox", { name: editor.state.description });
    await userEvent.click(canonicalSwitch());
    await userEvent.click(saveButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());

    expect(writeRequests()).toEqual([
      {
        body: { allowFamilyCycle: false, isCanonical: true },
        method: "PATCH",
        path: PATHS.relationship,
      },
    ]);
  });

  it("keeps the edits on screen when the book PUT fails after the PATCH", async () => {
    await saveCanonicalAndDescriptionWithFailingBookState();

    expect(descriptionField()).toHaveValue(NEW_DESCRIPTION);
    expect(canonicalSwitch()).toBeChecked();
    expect(screen.getByRole("dialog", { name: editor.editTitle })).toBeInTheDocument();
  });

  it("retries only the book PUT once the PATCH has already gone through", async () => {
    await saveCanonicalAndDescriptionWithFailingBookState();

    await userEvent.click(saveButton());
    await waitFor(() => expect(writeMethods()).toEqual(["PATCH", "PUT", "PUT"]));

    expect(writeRequests().at(-1)).toEqual(
      expect.objectContaining({
        body: expect.objectContaining({ description: NEW_DESCRIPTION }),
        path: PATHS.bookState,
      }),
    );
  });
});
