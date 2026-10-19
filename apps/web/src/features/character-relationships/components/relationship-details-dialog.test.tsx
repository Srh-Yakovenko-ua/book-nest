import "@testing-library/jest-dom/vitest";

import type { CharacterRelationshipSafeDetailsView } from "@app/shared";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import type { RelationshipAction } from "../model/relationship-adapter";
import type { RelationshipScope } from "../model/relationship-scope";

import { relationshipKeys } from "../api/relationship-keys";
import {
  makeMaskedRelationshipEdge,
  makeRelationshipBookState,
  makeRelationshipDetails,
  makeRelationshipEdge,
  makeRelationshipListItem,
  makeRelationshipPage,
  RELATIONSHIP_FIXTURE,
} from "../model/relationships.fixtures";
import { RelationshipDetailsDialog } from "./relationship-details-dialog";
import { RelationshipList } from "./relationship-list";

type DetailsReply = (url: URL) => Promise<Response>;

type DialogRender = {
  onDelete?: RelationshipAction;
  onEdit?: RelationshipAction;
  scope?: RelationshipScope;
};

const copy = messages.relationships;

const BOOK_ID = RELATIONSHIP_FIXTURE.book.id;

const BOOK_SCOPE: RelationshipScope = { bookId: BOOK_ID, kind: "book" };

const DETAILS_PATH = `/api/character-relationships/${RELATIONSHIP_FIXTURE.relationshipId}`;

const OPEN_LABEL = copy.card.open
  .replace("{source}", RELATIONSHIP_FIXTURE.geralt.name)
  .replace("{target}", RELATIONSHIP_FIXTURE.ciri.name);

const BOOK_STATES = [
  {
    description: "Ґеральт вимагає Право Несподіванки.",
    state: makeRelationshipBookState({
      bookTitle: "Останнє бажання",
      description: null,
      descriptionHidden: true,
      id: "state-1",
      partNumber: 1,
    }),
  },
  {
    description: "Ґеральт знаходить Цірі в Брокілоні.",
    state: makeRelationshipBookState({
      bookId: "7b7b7b7b-0000-4000-8000-000000000004",
      bookTitle: "Меч призначення",
      description: null,
      descriptionHidden: true,
      id: "state-2",
      partNumber: 2,
    }),
  },
] as const;

const [FIRST_BOOK, SECOND_BOOK] = BOOK_STATES;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let respondToDetails: DetailsReply;

async function confirmReveal() {
  const confirmation = await screen.findByRole("alertdialog");
  await userEvent.click(within(confirmation).getByRole("button", { name: copy.reveal.confirm }));
}

function detailsRequests(): URL[] {
  return requestedUrls().filter((url) => url.pathname.startsWith("/api/character-relationships/"));
}

function historyItem(bookTitle: string): HTMLElement {
  const item = screen.getByRole("heading", { level: 4, name: bookTitle }).closest("li");
  if (item === null) throw new Error(`no history entry for ${bookTitle}`);
  return item;
}

function json(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status,
    }),
  );
}

function lastDetailsParams(): Record<string, string> {
  const request = detailsRequests().at(-1);
  if (request === undefined) throw new Error("no relationship details request");
  return Object.fromEntries(request.searchParams);
}

function renderDialog({ onDelete, onEdit, scope = BOOK_SCOPE }: DialogRender = {}) {
  return renderWithProviders(
    <RelationshipDetailsDialog
      onClose={vi.fn()}
      onDelete={onDelete}
      onEdit={onEdit}
      open
      relationshipId={RELATIONSHIP_FIXTURE.relationshipId}
      scope={scope}
    />,
  );
}

function requestedUrls(): URL[] {
  return fetchMock.mock.calls.map(([input]) => new URL(String(input), "http://localhost"));
}

function serverDetails(url: URL): CharacterRelationshipSafeDetailsView {
  const isTypeRevealed = url.searchParams.get("revealType") === "true";
  const revealedStateId = url.searchParams.get("revealDescriptionBookStateId");
  const history = BOOK_STATES.map(({ description, state }) =>
    state.id === revealedStateId ? { ...state, description, descriptionHidden: false } : state,
  );

  return makeRelationshipDetails({
    effectiveState: history.at(-1) ?? null,
    history,
    relationship: isTypeRevealed
      ? makeRelationshipEdge({ sourceLabel: "названий батько" })
      : makeMaskedRelationshipEdge(),
  });
}

beforeEach(() => {
  respondToDetails = (url) => json(serverDetails(url));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = String(init?.method ?? "GET").toUpperCase();
    if (method === "GET" && url.pathname === DETAILS_PATH) return respondToDetails(url);
    if (method === "GET" && url.pathname === "/api/character-relationships") {
      return json(
        makeRelationshipPage([
          makeRelationshipListItem({ relationship: makeMaskedRelationshipEdge() }),
        ]),
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

describe("RelationshipDetailsDialog masked view", () => {
  it("opens masked, with a type reveal offer and hidden descriptions, and asks for no reveal", async () => {
    renderDialog();

    expect(await screen.findByText(copy.details.type.hiddenTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.details.type.reveal })).toBeInTheDocument();
    expect(screen.queryByText(copy.types.guardian_of)).not.toBeInTheDocument();
    expect(
      within(historyItem(FIRST_BOOK.state.bookTitle)).getByText(
        copy.details.history.descriptionHidden,
      ),
    ).toBeInTheDocument();
    expect(
      within(historyItem(SECOND_BOOK.state.bookTitle)).getByRole("button", {
        name: copy.details.history.revealDescription,
      }),
    ).toBeInTheDocument();
    expect(detailsRequests().map((url) => Object.fromEntries(url.searchParams))).toEqual([
      { scope: "book", scopeId: BOOK_ID },
    ]);
  });

  it("tells the reader the relationship is no longer available in this context", async () => {
    respondToDetails = () => json({ message: "Not found" }, 404);

    renderDialog();

    expect(await screen.findByText(copy.details.notAvailable.title)).toBeInTheDocument();
    expect(screen.getByText(copy.details.notAvailable.description)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: copy.details.error.retry }),
    ).not.toBeInTheDocument();
  });

  it("offers a retry for a failure other than a missing relationship", async () => {
    respondToDetails = () => json({ message: "boom" }, 500);

    renderDialog();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(copy.details.error.title);
    respondToDetails = (url) => json(serverDetails(url));

    await userEvent.click(within(alert).getByRole("button", { name: copy.details.error.retry }));

    expect(await screen.findByText(copy.details.type.hiddenTitle)).toBeInTheDocument();
  });

  it("keeps the loaded details on screen when a background refetch fails", async () => {
    const { queryClient } = renderDialog();
    await screen.findByText(copy.details.type.hiddenTitle);
    respondToDetails = () => json({ message: "boom" }, 500);

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: relationshipKeys.all });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(detailsRequests()).toHaveLength(2);
    expect(screen.getByText(copy.details.type.hiddenTitle)).toBeInTheDocument();
    expect(
      within(historyItem(SECOND_BOOK.state.bookTitle)).getByRole("button", {
        name: copy.details.history.revealDescription,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("RelationshipDetailsDialog type reveal", () => {
  it("asks first and requests nothing when the reader cancels", async () => {
    renderDialog();

    await userEvent.click(await screen.findByRole("button", { name: copy.details.type.reveal }));
    const confirmation = await screen.findByRole("alertdialog", { name: copy.reveal.type.title });
    expect(confirmation).toHaveTextContent(copy.reveal.type.description);
    await userEvent.click(within(confirmation).getByRole("button", { name: copy.reveal.cancel }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: copy.details.type.reveal })).toBeInTheDocument();
    expect(detailsRequests().some((url) => url.searchParams.has("revealType"))).toBe(false);
  });

  it("requests only the type after confirmation and keeps every description hidden", async () => {
    renderDialog();

    await userEvent.click(await screen.findByRole("button", { name: copy.details.type.reveal }));
    await confirmReveal();

    expect(await screen.findByText(copy.types.guardian_of)).toBeInTheDocument();
    expect(screen.getByText("Ґеральт: названий батько")).toBeInTheDocument();
    expect(screen.getAllByText(copy.details.history.descriptionHidden)).toHaveLength(2);
    expect(lastDetailsParams()).toEqual({ revealType: "true", scope: "book", scopeId: BOOK_ID });
  });
});

describe("RelationshipDetailsDialog description reveal", () => {
  it("asks first and then reveals the description of the chosen book state only", async () => {
    renderDialog();
    await screen.findByText(copy.details.type.hiddenTitle);

    await userEvent.click(
      within(historyItem(SECOND_BOOK.state.bookTitle)).getByRole("button", {
        name: copy.details.history.revealDescription,
      }),
    );
    const confirmation = await screen.findByRole("alertdialog", {
      name: copy.reveal.description.title,
    });
    expect(confirmation).toHaveTextContent(
      copy.reveal.description.description.replace("{book}", SECOND_BOOK.state.bookTitle),
    );
    await confirmReveal();

    expect(await screen.findByText(SECOND_BOOK.description)).toBeInTheDocument();
    expect(screen.queryByText(FIRST_BOOK.description)).not.toBeInTheDocument();
    expect(
      within(historyItem(FIRST_BOOK.state.bookTitle)).getByText(
        copy.details.history.descriptionHidden,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(copy.details.type.hiddenTitle)).toBeInTheDocument();
    expect(lastDetailsParams()).toEqual({
      revealDescriptionBookStateId: SECOND_BOOK.state.id,
      scope: "book",
      scopeId: BOOK_ID,
    });
  });

  it("replaces an earlier description reveal with the newly chosen one", async () => {
    renderDialog();
    await screen.findByText(copy.details.type.hiddenTitle);

    await userEvent.click(
      within(historyItem(FIRST_BOOK.state.bookTitle)).getByRole("button", {
        name: copy.details.history.revealDescription,
      }),
    );
    await confirmReveal();
    await screen.findByText(FIRST_BOOK.description);
    await userEvent.click(
      within(historyItem(SECOND_BOOK.state.bookTitle)).getByRole("button", {
        name: copy.details.history.revealDescription,
      }),
    );
    await confirmReveal();

    expect(await screen.findByText(SECOND_BOOK.description)).toBeInTheDocument();
    expect(screen.queryByText(FIRST_BOOK.description)).not.toBeInTheDocument();
    expect(lastDetailsParams()).toEqual({
      revealDescriptionBookStateId: SECOND_BOOK.state.id,
      scope: "book",
      scopeId: BOOK_ID,
    });
  });

  it("offers no description reveal in the global character view", async () => {
    renderDialog({
      scope: {
        characterId: RELATIONSHIP_FIXTURE.geralt.id,
        contextBookId: null,
        kind: "character",
      },
    });

    expect(await screen.findAllByText(copy.details.history.descriptionGlobal)).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: copy.details.history.revealDescription }),
    ).not.toBeInTheDocument();
  });
});

describe("RelationshipDetailsDialog actions", () => {
  it("shows no edit or delete action without callbacks", async () => {
    renderDialog();

    await screen.findByText(copy.details.type.hiddenTitle);
    expect(
      screen.queryByRole("button", { name: copy.details.actions.edit }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: copy.details.actions.delete }),
    ).not.toBeInTheDocument();
  });

  it("hands edit and delete to the page's callbacks with the relationship id", async () => {
    const onDelete = vi.fn<RelationshipAction>();
    const onEdit = vi.fn<RelationshipAction>();
    renderDialog({ onDelete, onEdit });

    await userEvent.click(await screen.findByRole("button", { name: copy.details.actions.edit }));
    await userEvent.click(screen.getByRole("button", { name: copy.details.actions.delete }));

    expect(onEdit).toHaveBeenCalledExactlyOnceWith(RELATIONSHIP_FIXTURE.relationshipId);
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(RELATIONSHIP_FIXTURE.relationshipId);
  });

  it("renders and reveals through the reader view only, never the authoring view", async () => {
    renderDialog({ onDelete: vi.fn(), onEdit: vi.fn() });

    await userEvent.click(await screen.findByRole("button", { name: copy.details.type.reveal }));
    await confirmReveal();
    await screen.findByText(copy.types.guardian_of);
    await userEvent.click(
      within(historyItem(FIRST_BOOK.state.bookTitle)).getByRole("button", {
        name: copy.details.history.revealDescription,
      }),
    );
    await confirmReveal();
    await screen.findByText(FIRST_BOOK.description);
    await userEvent.click(screen.getByRole("button", { name: copy.details.actions.edit }));

    expect(new Set(requestedUrls().map((url) => url.pathname))).toEqual(new Set([DETAILS_PATH]));
  });
});

describe("RelationshipDetailsDialog reset", () => {
  it("opens masked again after a reveal once the dialog is closed and reopened", async () => {
    renderWithProviders(
      <NuqsTestingAdapter hasMemory>
        <RelationshipList scope={BOOK_SCOPE} />
      </NuqsTestingAdapter>,
    );

    await userEvent.click(await screen.findByRole("button", { name: OPEN_LABEL }));
    const dialog = await screen.findByRole("dialog", { name: copy.details.title });
    await userEvent.click(
      await within(dialog).findByRole("button", { name: copy.details.type.reveal }),
    );
    await confirmReveal();
    expect(await within(dialog).findByText(copy.types.guardian_of)).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: OPEN_LABEL }));

    const reopened = await screen.findByRole("dialog", { name: copy.details.title });
    expect(
      await within(reopened).findByRole("button", { name: copy.details.type.reveal }),
    ).toBeInTheDocument();
    expect(within(reopened).queryByText(copy.types.guardian_of)).not.toBeInTheDocument();
    await waitFor(() => expect(lastDetailsParams()).toEqual({ scope: "book", scopeId: BOOK_ID }));
  });
});
