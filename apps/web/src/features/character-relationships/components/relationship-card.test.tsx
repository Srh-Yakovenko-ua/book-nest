import "@testing-library/jest-dom/vitest";

import type { CharacterRelationshipListItemView, Nullable } from "@app/shared";

import { describe, expect, it, onTestFinished, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { RelationshipActions } from "../model/relationship-adapter";

import {
  makeMaskedRelationshipEdge,
  makeRelationshipBookState,
  makeRelationshipEdge,
  makeRelationshipListItem,
  makeRelationshipParticipant,
  RELATIONSHIP_FIXTURE,
} from "../model/relationships.fixtures";
import { RelationshipCard } from "./relationship-card";

type CardRender = {
  actions?: RelationshipActions;
  focusCharacterId?: Nullable<string>;
  item?: CharacterRelationshipListItemView;
  onOpen?: (relationshipId: string) => void;
  showBookSummaries?: boolean;
};

const copy = messages.relationships;

const NAMES = { source: RELATIONSHIP_FIXTURE.geralt.name, target: RELATIONSHIP_FIXTURE.ciri.name };

const OPEN_LABEL = copy.card.open
  .replace("{source}", NAMES.source)
  .replace("{target}", NAMES.target);

const MENU_LABEL = copy.card.actions.menu
  .replace("{source}", NAMES.source)
  .replace("{target}", NAMES.target);

const SERIES_BOOKS = [
  "Останнє бажання",
  "Меч призначення",
  "Кров ельфів",
  "Час погорди",
  "Хрещення вогнем",
] as const;

function bookSummaries() {
  return SERIES_BOOKS.map((title, index) =>
    makeRelationshipBookState({
      bookId: `book-${index + 1}`,
      bookTitle: title,
      description: null,
      id: `state-${index + 1}`,
      partNumber: index + 1,
    }),
  );
}

function renderCard({
  actions = {},
  focusCharacterId = null,
  item = makeRelationshipListItem(),
  onOpen = vi.fn(),
  showBookSummaries = false,
}: CardRender = {}) {
  return renderWithProviders(
    <RelationshipCard
      actions={actions}
      focusCharacterId={focusCharacterId}
      item={item}
      onOpen={onOpen}
      showBookSummaries={showBookSummaries}
    />,
  );
}

describe("RelationshipCard type", () => {
  it("shows the category, the type, the role labels and the canon badge of a visible edge", () => {
    renderCard({
      item: makeRelationshipListItem({
        relationship: makeRelationshipEdge({
          sourceLabel: "названий батько",
          targetLabel: "Дитя Несподіванки",
        }),
      }),
    });

    expect(screen.getByText(copy.categories.family)).toBeInTheDocument();
    expect(screen.getByText(copy.types.guardian_of)).toBeInTheDocument();
    expect(screen.getByText("Ґеральт: названий батько")).toBeInTheDocument();
    expect(screen.getByText("Цірі: Дитя Несподіванки")).toBeInTheDocument();
    expect(screen.getByText(copy.card.canonical)).toBeInTheDocument();
    expect(screen.queryByText(copy.card.typeHidden)).not.toBeInTheDocument();
  });

  it("shows only the neutral hidden-type chip for a masked edge", () => {
    renderCard({ item: makeRelationshipListItem({ relationship: makeMaskedRelationshipEdge() }) });

    expect(screen.getByText(copy.card.typeHidden)).toBeInTheDocument();
    for (const category of Object.values(copy.categories)) {
      expect(screen.queryByText(category)).not.toBeInTheDocument();
    }
    expect(screen.queryByText(copy.types.custom)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Ґеральт:|^Цірі:/)).not.toBeInTheDocument();
    expect(screen.queryByText(copy.card.canonical)).not.toBeInTheDocument();
  });

  it("names a custom type by its own text", () => {
    renderCard({
      item: makeRelationshipListItem({
        relationship: makeRelationshipEdge({
          category: "custom",
          customType: "Вірний супутник",
          type: "custom",
        }),
      }),
    });

    expect(screen.getByText("Вірний супутник")).toBeInTheDocument();
    expect(screen.queryByText(copy.types.custom)).not.toBeInTheDocument();
  });

  it.each([false, null])("shows no canon badge when the edge canonicality is %s", (isCanonical) => {
    renderCard({
      item: makeRelationshipListItem({ relationship: makeRelationshipEdge({ isCanonical }) }),
    });

    expect(screen.getByText(copy.types.guardian_of)).toBeInTheDocument();
    expect(screen.queryByText(copy.card.canonical)).not.toBeInTheDocument();
  });
});

describe("RelationshipCard direction", () => {
  it.each([
    { directionality: "directed", label: copy.directionality.directed },
    { directionality: "symmetric", label: copy.directionality.symmetric },
  ] as const)("labels a $directionality edge connector", ({ directionality, label }) => {
    renderCard({
      item: makeRelationshipListItem({ relationship: makeRelationshipEdge({ directionality }) }),
    });

    expect(screen.getByRole("img", { name: label })).toBeInTheDocument();
  });

  it("draws a neutral connector, never an arrow, when the direction is masked", () => {
    renderCard({ item: makeRelationshipListItem({ relationship: makeMaskedRelationshipEdge() }) });

    expect(screen.getByRole("img", { name: copy.directionality.hidden })).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: copy.directionality.directed }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: copy.directionality.symmetric }),
    ).not.toBeInTheDocument();
  });
});

describe("RelationshipCard state", () => {
  it("shows the effective status and intensity", () => {
    renderCard();

    expect(screen.getByText(copy.statuses.active)).toBeInTheDocument();
    expect(screen.getByText(copy.intensities.medium)).toBeInTheDocument();
  });

  it("shows no status or intensity chip when the server withholds both", () => {
    renderCard({
      item: makeRelationshipListItem({
        effectiveState: makeRelationshipBookState({ intensity: null, status: null }),
      }),
    });

    for (const label of [...Object.values(copy.statuses), ...Object.values(copy.intensities)]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it("shows the excerpt of a visible description", () => {
    renderCard();

    expect(screen.getByText(RELATIONSHIP_FIXTURE.description)).toBeInTheDocument();
    expect(screen.queryByText(copy.card.descriptionHidden)).not.toBeInTheDocument();
  });

  it("shows the hidden-description note instead of the description", () => {
    renderCard({
      item: makeRelationshipListItem({
        effectiveState: makeRelationshipBookState({ description: null, descriptionHidden: true }),
      }),
    });

    expect(screen.getByText(copy.card.descriptionHidden)).toBeInTheDocument();
    expect(screen.queryByText(RELATIONSHIP_FIXTURE.description)).not.toBeInTheDocument();
  });

  it("shows no hidden-description note for a state that simply has no description", () => {
    renderCard({
      item: makeRelationshipListItem({
        effectiveState: makeRelationshipBookState({ description: null, descriptionHidden: false }),
      }),
    });

    expect(screen.queryByText(copy.card.descriptionHidden)).not.toBeInTheDocument();
  });
});

describe("RelationshipCard participants", () => {
  it("puts the other participant first on the card of the source character", () => {
    renderCard({ focusCharacterId: RELATIONSHIP_FIXTURE.geralt.id });

    expect(screen.getByRole("button", { name: OPEN_LABEL })).toHaveTextContent(/Цірі.*Ґеральт/);
  });

  it.each([
    { focusCharacterId: RELATIONSHIP_FIXTURE.ciri.id, view: "the card of the target character" },
    { focusCharacterId: null, view: "a book or series list" },
  ])("keeps the source first on $view", ({ focusCharacterId }) => {
    renderCard({ focusCharacterId });

    expect(screen.getByRole("button", { name: OPEN_LABEL })).toHaveTextContent(/Ґеральт.*Цірі/);
  });

  it("shows both role labels of two participants who share a name without a duplicate key warning", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    onTestFinished(() => consoleError.mockRestore());
    renderCard({
      item: makeRelationshipListItem({
        relationship: makeRelationshipEdge({
          sourceLabel: "батько",
          target: makeRelationshipParticipant({
            id: RELATIONSHIP_FIXTURE.ciri.id,
            name: NAMES.source,
          }),
          targetLabel: "син",
        }),
      }),
    });

    expect(screen.getByText(`${NAMES.source}: батько`)).toBeInTheDocument();
    expect(screen.getByText(`${NAMES.source}: син`)).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe("RelationshipCard book summaries", () => {
  it("shows at most three book chips in the global view and counts the rest", () => {
    renderCard({
      item: makeRelationshipListItem({ bookSummaries: bookSummaries(), effectiveState: null }),
      showBookSummaries: true,
    });

    const books = within(screen.getByRole("list", { name: copy.card.books }));
    expect(books.getAllByRole("listitem")).toHaveLength(4);
    expect(books.getByText(SERIES_BOOKS[0])).toBeInTheDocument();
    expect(books.getByText(SERIES_BOOKS[2])).toBeInTheDocument();
    expect(books.queryByText(SERIES_BOOKS[3])).not.toBeInTheDocument();
    expect(books.getByText(copy.card.moreBooks.replace("{count}", "2"))).toBeInTheDocument();
  });

  it("shows the visible status next to each book", () => {
    renderCard({
      item: makeRelationshipListItem({
        bookSummaries: bookSummaries().slice(0, 1),
        effectiveState: null,
      }),
      showBookSummaries: true,
    });

    const books = within(screen.getByRole("list", { name: copy.card.books }));
    expect(books.getByRole("listitem")).toHaveTextContent(
      new RegExp(`${SERIES_BOOKS[0]}.*${copy.statuses.active}`),
    );
  });

  it("shows no count chip for three books or fewer", () => {
    renderCard({
      item: makeRelationshipListItem({
        bookSummaries: bookSummaries().slice(0, 3),
        effectiveState: null,
      }),
      showBookSummaries: true,
    });

    const books = within(screen.getByRole("list", { name: copy.card.books }));
    expect(books.getAllByRole("listitem")).toHaveLength(3);
    expect(books.queryByText(/^\+\d/)).not.toBeInTheDocument();
  });

  it("shows no book chips outside the global character view", () => {
    renderCard({
      item: makeRelationshipListItem({ bookSummaries: bookSummaries() }),
      showBookSummaries: false,
    });

    expect(screen.queryByRole("list", { name: copy.card.books })).not.toBeInTheDocument();
  });
});

describe("RelationshipCard actions", () => {
  it("opens the details of its relationship", async () => {
    const onOpen = vi.fn<(relationshipId: string) => void>();
    renderCard({ onOpen });

    await userEvent.click(screen.getByRole("button", { name: OPEN_LABEL }));

    expect(onOpen).toHaveBeenCalledExactlyOnceWith(RELATIONSHIP_FIXTURE.relationshipId);
  });

  it("offers no action menu without callbacks", () => {
    renderCard();

    expect(screen.queryByRole("button", { name: MENU_LABEL })).not.toBeInTheDocument();
  });

  it("offers only edit when only an edit callback is given and reports the relationship", async () => {
    const onEdit = vi.fn<(relationshipId: string) => void>();
    renderCard({ actions: { onEdit } });

    await userEvent.click(screen.getByRole("button", { name: MENU_LABEL }));
    await userEvent.click(await screen.findByRole("menuitem", { name: copy.card.actions.edit }));

    expect(onEdit).toHaveBeenCalledExactlyOnceWith(RELATIONSHIP_FIXTURE.relationshipId);
  });

  it("lists no delete item without a delete callback", async () => {
    renderCard({ actions: { onEdit: vi.fn() } });

    await userEvent.click(screen.getByRole("button", { name: MENU_LABEL }));

    expect(
      await screen.findByRole("menuitem", { name: copy.card.actions.edit }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: copy.card.actions.delete }),
    ).not.toBeInTheDocument();
  });

  it("reports the relationship to delete without opening its details", async () => {
    const onDelete = vi.fn<(relationshipId: string) => void>();
    const onOpen = vi.fn<(relationshipId: string) => void>();
    renderCard({ actions: { onDelete }, onOpen });

    await userEvent.click(screen.getByRole("button", { name: MENU_LABEL }));
    await userEvent.click(await screen.findByRole("menuitem", { name: copy.card.actions.delete }));

    expect(onDelete).toHaveBeenCalledExactlyOnceWith(RELATIONSHIP_FIXTURE.relationshipId);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
