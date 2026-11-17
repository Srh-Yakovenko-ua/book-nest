import "@testing-library/jest-dom/vitest";

import type {
  CharacterRelationshipCustomTypeView,
  CharacterRelationshipDetailsView,
  CharacterRelationshipRoleSuggestionView,
  Nullable,
  UpdateCharacterRelationship,
} from "@app/shared";
import type { ReactNode } from "react";

import { UpdateCharacterRelationshipSchema } from "@app/shared";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

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

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), warning: vi.fn() }),
}));

type WriteRequest = { body: unknown; method: string; path: string };

const copy = messages.relationships;
const editor = copy.editor;
const labels = editor.labels;

const BOOK = RELATIONSHIP_FIXTURE.book;
const RELATIONSHIP_ID = RELATIONSHIP_FIXTURE.relationshipId;

const BOOK_SCOPE: Extract<RelationshipScope, { kind: "book" }> = {
  bookId: BOOK.id,
  kind: "book",
};

const PATHS = {
  bookState: `/api/character-relationships/${RELATIONSHIP_ID}/books/${BOOK.id}`,
  customTypes: "/api/character-relationship-custom-types",
  editable: `/api/character-relationships/${RELATIONSHIP_ID}/edit`,
  relationship: `/api/character-relationships/${RELATIONSHIP_ID}`,
  roleSuggestions: "/api/character-relationship-role-suggestions",
} as const;

const ROLES = {
  exact: { id: "6f1c2d3e-4a5b-4c6d-8e7f-901a2b3c4d5e", label: "Наставник" },
  partial: { id: "7a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", label: "Старший наставник" },
  pupil: { id: "8b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e", label: "Учениця" },
} as const satisfies Record<string, CharacterRelationshipRoleSuggestionView>;

const ROLES_BY_LAST_USE = [ROLES.partial, ROLES.exact, ROLES.pupil];

const ROLE_FIELD_NAMES = {
  source: labels.source.replace("{name}", RELATIONSHIP_FIXTURE.geralt.name),
  target: labels.target.replace("{name}", RELATIONSHIP_FIXTURE.ciri.name),
};

const CUSTOM_TYPES = {
  exact: {
    directionality: "symmetric",
    id: "9c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f",
    name: "Побратими",
  },
  named: {
    directionality: "symmetric",
    id: "0d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f7a",
    name: "Названі побратими",
  },
} as const satisfies Record<string, CharacterRelationshipCustomTypeView>;

const STORED_STATE = makeEditableBookState({
  introducedAudioSeconds: 3930,
  introducedChapter: "Розділ 3",
  isTypeSpoiler: true,
});

const NEW_DESCRIPTION = "Ґеральт знаходить Цірі в Брокілоні.";

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let failingPatches: number;
let failingSuggestions: number;
let failingUpserts: number;
let savedCustomTypes: CharacterRelationshipCustomTypeView[];
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

function customTypePage() {
  return {
    items: savedCustomTypes,
    page: 1,
    pagesCount: savedCustomTypes.length === 0 ? 0 : 1,
    pageSize: 20,
    totalCount: savedCustomTypes.length,
  };
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

function requestsTo(pathname: string): URL[] {
  return fetchMock.mock.calls.flatMap(([input]) => {
    const url = new URL(String(input), "http://localhost");
    return url.pathname === pathname ? [url] : [];
  });
}

async function rewriteDescription() {
  const field = await screen.findByRole("textbox", { name: editor.state.description });
  await userEvent.clear(field);
  await userEvent.type(field, NEW_DESCRIPTION);
}

function roleField(side: keyof typeof ROLE_FIELD_NAMES): HTMLElement {
  return screen.getByRole("combobox", { name: ROLE_FIELD_NAMES[side] });
}

function rolePage(request: URL) {
  const term = request.searchParams.get("q")?.toLowerCase();
  const items =
    term === undefined
      ? ROLES_BY_LAST_USE
      : ROLES_BY_LAST_USE.filter((role) => role.label.toLowerCase().includes(term));
  return {
    items,
    page: 1,
    pagesCount: Math.ceil(items.length / 20),
    pageSize: 20,
    totalCount: items.length,
  };
}

function roleSearchTerms(): string[] {
  return requestsTo(PATHS.roleSuggestions).flatMap((request) => {
    const term = request.searchParams.get("q");
    return term === null ? [] : [term];
  });
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

function serveSuggestions(page: unknown): Promise<Response> {
  if (failingSuggestions > 0) {
    failingSuggestions -= 1;
    return Promise.resolve(jsonResponse({ message: "Internal server error" }, 500));
  }
  return Promise.resolve(jsonResponse(page));
}

async function showRoleFields() {
  await userEvent.click(await screen.findByRole("button", { name: labels.toggle }));
}

function suggestedRoles(): Nullable<string>[] {
  return within(screen.getByRole("listbox", { name: labels.suggestions.list }))
    .getAllByRole("option")
    .map((option) => option.textContent);
}

function typedRoleLabel(role: string): string {
  return labels.suggestions.useTyped.replace("{role}", role);
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
  failingPatches = 0;
  failingSuggestions = 0;
  failingUpserts = 0;
  savedCustomTypes = [];
  stored = makeEditableRelationship({ bookStates: [STORED_STATE] });

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const { pathname } = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET" && pathname === PATHS.editable) {
      return Promise.resolve(jsonResponse(stored));
    }
    if (method === "GET" && pathname === PATHS.roleSuggestions) {
      return serveSuggestions(rolePage(new URL(String(input), "http://localhost")));
    }
    if (method === "GET" && pathname === PATHS.customTypes) {
      return serveSuggestions(customTypePage());
    }
    if (method === "PATCH" && pathname === PATHS.relationship) {
      if (failingPatches > 0) {
        failingPatches -= 1;
        return Promise.resolve(jsonResponse({ message: "Internal server error" }, 500));
      }
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

    expect(await screen.findByRole("combobox", { name: editor.type.customLabel })).toHaveValue(
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
      screen.queryByRole("radiogroup", { name: editor.type.directionality }),
    ).not.toBeInTheDocument();
  });

  it("R33 offers nothing to save until something changed", async () => {
    renderEditor();

    await screen.findByRole("textbox", { name: editor.state.description });

    expect(saveButton()).toBeDisabled();
  });

  it("R43 Edit DoD keeps the stored canonical flag and a fixed direction for a catalog type", async () => {
    stored = makeEditableRelationship({ bookStates: [STORED_STATE], isCanonical: true });
    renderEditor();

    expect(await screen.findByRole("switch", { name: editor.type.canonical })).toBeChecked();
    expect(screen.getByText(editor.type.directionalityAuto)).toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: editor.type.directionality }),
    ).not.toBeInTheDocument();
  });

  it("R43 opens with the stored canonical flag and both stored roles in their own controls", async () => {
    stored = makeEditableRelationship({
      bookStates: [STORED_STATE],
      isCanonical: true,
      sourceLabel: ROLES.exact.label,
      targetLabel: ROLES.pupil.label,
    });
    renderEditor();

    expect(await screen.findByRole("combobox", { name: ROLE_FIELD_NAMES.source })).toHaveValue(
      ROLES.exact.label,
    );
    expect(roleField("target")).toHaveValue(ROLES.pupil.label);
    expect(canonicalSwitch()).toBeChecked();
    expect(saveButton()).toBeDisabled();
  });

  it("explains the status with the approved plot-secret hint", async () => {
    renderEditor();

    expect(await screen.findByText(editor.state.statusHint)).toBeInTheDocument();
  });
});

describe("RelationshipEditorDialog edit: saving", () => {
  it("R33 sends only the book PUT, keeping the stored details, for a book-only change", async () => {
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

  it("R33 sends only the PATCH when only the relationship itself changed", async () => {
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

  it("R33 sends the PATCH and then the book PUT, once each, when both the relationship and its book details changed", async () => {
    const { onClose } = renderEditor();

    await rewriteDescription();
    await userEvent.click(canonicalSwitch());
    await userEvent.click(saveButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());

    expect(writeRequests()).toEqual([
      {
        body: { allowFamilyCycle: false, isCanonical: true },
        method: "PATCH",
        path: PATHS.relationship,
      },
      {
        body: expect.objectContaining({ description: NEW_DESCRIPTION, isTypeSpoiler: true }),
        method: "PUT",
        path: PATHS.bookState,
      },
    ]);
  });

  it("T13 E09 sends no book PUT and reports the failure when the PATCH fails", async () => {
    failingPatches = 1;
    renderEditor();
    await rewriteDescription();
    await userEvent.click(canonicalSwitch());

    await userEvent.click(saveButton());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(copy.toast.updateError));
    await waitFor(() => expect(saveButton()).toBeEnabled());

    expect(writeMethods()).toEqual(["PATCH"]);
    expect(screen.queryByText(editor.partialSave.title)).not.toBeInTheDocument();
  });

  it("T14 keeps the edits and shows a partial save, not success, when the book PUT fails", async () => {
    await saveCanonicalAndDescriptionWithFailingBookState();

    expect(descriptionField()).toHaveValue(NEW_DESCRIPTION);
    expect(canonicalSwitch()).toBeChecked();
    expect(screen.getByRole("dialog", { name: editor.editTitle })).toBeInTheDocument();
    expect(screen.getByText(editor.partialSave.title)).toBeInTheDocument();
    expect(screen.getByText(editor.partialSave.description)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("T14 retries only the book PUT once the PATCH has already gone through", async () => {
    await saveCanonicalAndDescriptionWithFailingBookState();

    await userEvent.click(saveButton());
    await waitFor(() => expect(writeMethods()).toEqual(["PATCH", "PUT", "PUT"]));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(copy.toast.updated));

    expect(writeMethods()).toEqual(["PATCH", "PUT", "PUT"]);
    expect(writeRequests().at(-1)).toEqual(
      expect.objectContaining({
        body: expect.objectContaining({ description: NEW_DESCRIPTION }),
        path: PATHS.bookState,
      }),
    );
  });

  it("T14 retries the book details from the partial-save notice and then confirms the save", async () => {
    await saveCanonicalAndDescriptionWithFailingBookState();

    await userEvent.click(screen.getByRole("button", { name: editor.partialSave.retry }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(copy.toast.updated));

    expect(writeMethods()).toEqual(["PATCH", "PUT", "PUT"]);
  });

  it("T14 sends the PATCH again on retry only for an edge field changed after the partial save", async () => {
    await saveCanonicalAndDescriptionWithFailingBookState();

    await userEvent.click(canonicalSwitch());
    await userEvent.click(saveButton());
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(copy.toast.updated));

    expect(writeRequests().slice(2)).toEqual([
      {
        body: { allowFamilyCycle: false, isCanonical: false },
        method: "PATCH",
        path: PATHS.relationship,
      },
      expect.objectContaining({ method: "PUT", path: PATHS.bookState }),
    ]);
  });
});

describe("RelationshipEditorDialog edit: roles", () => {
  it("R43 §7.2 E01 shows both stored roles exactly as saved and keeps them once suggestions load", async () => {
    stored = makeEditableRelationship({
      bookStates: [STORED_STATE],
      sourceLabel: "старший  НАСТАВНИК",
      targetLabel: "Учениця Ґеральта",
    });
    renderEditor();

    await userEvent.click(await screen.findByRole("combobox", { name: ROLE_FIELD_NAMES.source }));
    await screen.findByRole("option", { name: ROLES.partial.label });
    await userEvent.tab();

    expect(roleField("source")).toHaveValue("старший  НАСТАВНИК");
    expect(roleField("target")).toHaveValue("Учениця Ґеральта");
    expect(saveButton()).toBeDisabled();
  });

  it("§7.2 E02 E09 saves new roles for both sides in the PATCH alone, with no dictionary write", async () => {
    const { onClose } = renderEditor();
    await showRoleFields();

    await userEvent.type(roleField("source"), "охоронець");
    await userEvent.type(roleField("target"), "підопічна");
    await userEvent.click(saveButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());

    expect(writeRequests()).toEqual([
      {
        body: { allowFamilyCycle: false, sourceLabel: "охоронець", targetLabel: "підопічна" },
        method: "PATCH",
        path: PATHS.relationship,
      },
    ]);
  });

  it("E05 lists the saved role matching the typed text first and fills in its saved spelling", async () => {
    renderEditor();
    await showRoleFields();

    await userEvent.type(roleField("source"), "наставник");
    await waitFor(() => expect(suggestedRoles()).toEqual([ROLES.exact.label, ROLES.partial.label]));
    await userEvent.click(screen.getByRole("option", { name: ROLES.exact.label }));

    expect(roleField("source")).toHaveValue(ROLES.exact.label);
  });

  it("§7.2 offers the typed role as the first row and keeps the typed text when it is chosen", async () => {
    renderEditor();
    await showRoleFields();

    await userEvent.type(roleField("source"), "Старший");
    await waitFor(() =>
      expect(suggestedRoles()).toEqual([typedRoleLabel("Старший"), ROLES.partial.label]),
    );
    await userEvent.click(screen.getByRole("option", { name: typedRoleLabel("Старший") }));

    expect(roleField("source")).toHaveValue("Старший");
    expect(
      screen.queryByRole("listbox", { name: labels.suggestions.list }),
    ).not.toBeInTheDocument();
  });

  it("§7.2 applies the typed role with its runs of spaces collapsed and the ends trimmed", async () => {
    renderEditor();
    await showRoleFields();

    await userEvent.type(roleField("source"), "  Старший    учень ");
    await userEvent.click(
      await screen.findByRole("option", { name: typedRoleLabel("Старший учень") }),
    );

    expect(roleField("source")).toHaveValue("Старший учень");
  });

  it("§7.2 E07 asks for a second character before searching, then searches by the typed term", async () => {
    renderEditor();
    await showRoleFields();

    await userEvent.type(roleField("source"), "н");

    expect(roleField("source")).toHaveAccessibleDescription(labels.suggestions.searchHint);

    await userEvent.type(roleField("source"), "а");

    await waitFor(() => expect(roleSearchTerms()).toEqual(["на"]));
  });

  it("§7.2 Enter fills the role from the active suggestion without submitting the form", async () => {
    const { onClose } = renderEditor();
    await showRoleFields();
    await userEvent.click(roleField("source"));
    await screen.findByRole("option", { name: ROLES.partial.label });

    await userEvent.keyboard("{ArrowDown}");
    await screen.findByRole("option", { name: ROLES.exact.label, selected: true });
    await userEvent.keyboard("{Enter}");

    expect(roleField("source")).toHaveValue(ROLES.exact.label);
    expect(saveButton()).toBeEnabled();
    expect(writeRequests()).toEqual([]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("§7.2 Escape closes the suggestions and keeps the typed role without leaving the editor", async () => {
    renderEditor();
    await showRoleFields();
    await userEvent.type(roleField("source"), "охорон");
    await screen.findByRole("listbox", { name: labels.suggestions.list });

    await userEvent.keyboard("{Escape}");

    expect(
      screen.queryByRole("listbox", { name: labels.suggestions.list }),
    ).not.toBeInTheDocument();
    expect(roleField("source")).toHaveAttribute("aria-expanded", "false");
    expect(roleField("source")).not.toHaveAttribute("aria-controls");
    expect(roleField("source")).toHaveValue("охорон");
    expect(
      screen.queryByRole("alertdialog", { name: editor.discard.title }),
    ).not.toBeInTheDocument();
  });

  it("E08 announces a suggestions failure as a status outside the list, with no alert or retry button", async () => {
    failingSuggestions = 1;
    renderEditor();
    await showRoleFields();
    await userEvent.click(roleField("source"));

    const status = await screen.findByText(labels.suggestions.error);

    expect(status).toHaveRole("status");
    expect(screen.getByRole("listbox", { name: labels.suggestions.list })).not.toContainElement(
      status,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it("E08 brings the suggestions back from the retry option", async () => {
    failingSuggestions = 1;
    renderEditor();
    await showRoleFields();
    await userEvent.click(roleField("source"));

    await userEvent.click(await screen.findByRole("option", { name: messages.common.retry }));

    expect(await screen.findByRole("option", { name: ROLES.exact.label })).toBeInTheDocument();
  });

  it("E08 highlights the lone retry option so Enter brings the suggestions back without saving", async () => {
    failingSuggestions = 1;
    const { onClose } = renderEditor();
    await showRoleFields();
    await userEvent.click(roleField("source"));

    await screen.findByRole("option", { name: messages.common.retry, selected: true });
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByRole("option", { name: ROLES.exact.label })).toBeInTheDocument();
    expect(writeRequests()).toEqual([]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("E08 still saves a typed role while its suggestions fail to load", async () => {
    failingSuggestions = Number.POSITIVE_INFINITY;
    const { onClose } = renderEditor();
    await showRoleFields();

    await userEvent.type(roleField("source"), "охоронець");
    await screen.findByText(labels.suggestions.error);
    await userEvent.click(saveButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());

    expect(writeRequests()).toEqual([
      {
        body: { allowFamilyCycle: false, sourceLabel: "охоронець" },
        method: "PATCH",
        path: PATHS.relationship,
      },
    ]);
  });

  it("E09 sends nothing when an edited role is discarded", async () => {
    const { onClose } = renderEditor();
    await showRoleFields();

    await userEvent.type(roleField("source"), "охоронець");
    await userEvent.click(screen.getByRole("button", { name: editor.actions.cancel }));
    await userEvent.click(
      await screen.findByRole("button", { name: messages.common.discardChanges.confirm }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());

    expect(writeRequests()).toEqual([]);
  });
});

describe("RelationshipEditorDialog edit: custom type", () => {
  beforeEach(() => {
    stored = makeEditableRelationship({
      bookStates: [STORED_STATE],
      category: "custom",
      customType: "побратими",
      directionality: "symmetric",
      type: "custom",
    });
  });

  it("T12 §6.4 asks only for saved custom types with the edge's own direction", async () => {
    renderEditor();

    await userEvent.click(await screen.findByRole("combobox", { name: editor.type.customLabel }));
    await waitFor(() => expect(requestsTo(PATHS.customTypes)).not.toHaveLength(0));
    const directions = requestsTo(PATHS.customTypes).map((request) =>
      request.searchParams.get("directionality"),
    );

    expect(new Set(directions)).toEqual(new Set(["symmetric"]));
  });

  it("T12 §6.4 renames the custom type through a PATCH that carries no direction", async () => {
    const { onClose } = renderEditor();
    const field = await screen.findByRole("combobox", { name: editor.type.customLabel });

    await userEvent.clear(field);
    await userEvent.type(field, "названі брати");
    await userEvent.click(saveButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());

    expect(writeRequests()).toEqual([
      {
        body: expect.objectContaining({ customType: "названі брати" }),
        method: "PATCH",
        path: PATHS.relationship,
      },
    ]);
    expect(writeRequests().at(0)?.body).not.toHaveProperty("directionality");
  });

  it("§6.4 saves a typed custom name while its suggestions fail to load", async () => {
    failingSuggestions = Number.POSITIVE_INFINITY;
    const { onClose } = renderEditor();
    const field = await screen.findByRole("combobox", { name: editor.type.customLabel });

    await userEvent.clear(field);
    await userEvent.type(field, "названі брати");
    await screen.findByText(editor.customType.error);
    await userEvent.click(saveButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());

    expect(writeMethods()).toEqual(["PATCH"]);
  });

  it("R32 focuses the custom type name on open and leaves its suggestions closed", async () => {
    renderEditor();
    const field = await screen.findByRole("combobox", { name: editor.type.customLabel });

    await waitFor(() => expect(field).toHaveFocus());
    expect(field).toHaveAttribute("aria-required", "true");
    expect(field).toHaveAttribute("aria-expanded", "false");
    expect(field).not.toHaveAttribute("aria-controls");
    expect(
      screen.queryByRole("listbox", { name: editor.customType.suggestions }),
    ).not.toBeInTheDocument();
    expect(requestsTo(PATHS.customTypes)).toEqual([]);
  });

  it("R32 reopens the suggestions with ArrowDown after Escape and applies the highlighted saved type with Enter without saving", async () => {
    savedCustomTypes = [CUSTOM_TYPES.named, CUSTOM_TYPES.exact];
    const exactMatch = new RegExp(`^${CUSTOM_TYPES.exact.name}`);
    const { onClose } = renderEditor();
    const field = await screen.findByRole("combobox", { name: editor.type.customLabel });
    await userEvent.click(field);
    await screen.findByRole("option", { name: exactMatch });

    await userEvent.keyboard("{Escape}");
    expect(
      screen.queryByRole("listbox", { name: editor.customType.suggestions }),
    ).not.toBeInTheDocument();
    expect(field).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{ArrowDown}");
    await screen.findByRole("option", { name: exactMatch, selected: true });
    expect(field).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{Enter}");

    expect(field).toHaveValue(CUSTOM_TYPES.exact.name);
    expect(
      screen.queryByRole("listbox", { name: editor.customType.suggestions }),
    ).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
    expect(writeRequests()).toEqual([]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("§6.4 lists the saved type matching the typed name first, with no offer to use the typed text", async () => {
    savedCustomTypes = [CUSTOM_TYPES.named, CUSTOM_TYPES.exact];
    renderEditor();

    await userEvent.click(await screen.findByRole("combobox", { name: editor.type.customLabel }));
    const list = await screen.findByRole("listbox", { name: editor.customType.suggestions });
    await within(list).findByRole("option", { name: new RegExp(`^${CUSTOM_TYPES.named.name}`) });
    const options = within(list).getAllByRole("option");

    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAccessibleName(new RegExp(`^${CUSTOM_TYPES.exact.name}`));
  });

  it("§6.4 offers the typed name with its spaces collapsed as the first option and applies it on click", async () => {
    savedCustomTypes = [CUSTOM_TYPES.named, CUSTOM_TYPES.exact];
    renderEditor();
    const field = await screen.findByRole("combobox", { name: editor.type.customLabel });

    await userEvent.clear(field);
    await userEvent.type(field, "  названі   брати ");
    const typedName = await screen.findByRole("option", {
      name: editor.customType.useTyped.replace("{name}", "названі брати"),
    });
    const list = screen.getByRole("listbox", { name: editor.customType.suggestions });
    expect(within(list).getAllByRole("option")[0]).toBe(typedName);
    await userEvent.click(typedName);

    expect(field).toHaveValue("названі брати");
    expect(field).toHaveFocus();
  });
});
