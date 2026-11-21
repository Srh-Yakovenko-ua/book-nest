import type { ComponentProps } from "react";

import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { GraphPersonNearestItem } from "./graph-person-character-details";

import {
  makeRelationshipGraphEdge,
  makeRelationshipGraphNode,
  RELATIONSHIP_FIXTURE,
} from "../../model/relationships.fixtures";
import { GraphPersonCharacterDetails } from "./graph-person-character-details";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

const person = messages.relationships.workspace.panel.person;

const importance = messages.characters.importance;

const translatePerson = createTranslator({
  locale: "uk",
  messages,
  namespace: "relationships.workspace.panel.person",
});

const NODE = makeRelationshipGraphNode({ importance: "central" });

const NEAREST = Array.from({ length: 5 }, (_, index): GraphPersonNearestItem => ({
  connectionId: `connection-${index}`,
  other: makeRelationshipGraphNode({ id: `neighbor-${index}`, name: `Neighbor ${index + 1}` }),
  semantics: {
    direction: { kind: "symmetric" },
    relationshipCount: 1,
    singleEdge: makeRelationshipGraphEdge({
      id: `edge-${index}`,
      source: NODE.id,
      target: `neighbor-${index}`,
    }),
    tone: "family",
  },
}));

function nearestRows() {
  return screen.getAllByRole("button", { name: /Neighbor/ });
}

function renderDetails(
  overrides: Partial<ComponentProps<typeof GraphPersonCharacterDetails>> = {},
) {
  renderWithProviders(
    <GraphPersonCharacterDetails
      bookId={RELATIONSHIP_FIXTURE.book.id}
      branch={null}
      isPartial={false}
      isRoot={false}
      mapCharacters={6}
      nearest={NEAREST}
      node={NODE}
      onFindPath={vi.fn()}
      onMakeCenter={vi.fn()}
      onOpenConnection={vi.fn()}
      reach={{ neighbors: 5, relationships: 7 }}
      {...overrides}
    />,
  );
}

describe("GraphPersonCharacterDetails", () => {
  it("previews 3 of 5 nearest connections behind a collapsed show-all toggle", () => {
    renderDetails();

    expect(nearestRows()).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /Neighbor 4/ })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: translatePerson("nearestAll", { count: 5 }) }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("lists all 5 nearest connections after the toggle and offers to collapse them", async () => {
    renderDetails();

    await userEvent.click(
      screen.getByRole("button", { name: translatePerson("nearestAll", { count: 5 }) }),
    );

    expect(nearestRows()).toHaveLength(5);
    expect(screen.getByRole("button", { name: person.nearestLess })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("shows 3 nearest connections without a toggle when there are no more", () => {
    renderDetails({ nearest: NEAREST.slice(0, 3) });

    const section = screen.getByRole("region", { name: person.nearest });
    expect(nearestRows()).toHaveLength(3);
    expect(within(section).queryByRole("button", { expanded: false })).not.toBeInTheDocument();
    expect(within(section).queryByRole("button", { expanded: true })).not.toBeInTheDocument();
  });

  it("opens the clicked nearest connection by its id", async () => {
    const onOpenConnection = vi.fn();
    renderDetails({ onOpenConnection });

    await userEvent.click(screen.getByRole("button", { name: /Neighbor 2/ }));

    expect(onOpenConnection).toHaveBeenCalledExactlyOnceWith("connection-1");
  });

  it("pairs each map counter with its pluralized term", () => {
    renderDetails();

    const stats = screen.getByRole("region", { name: person.stats.label });
    const terms = within(stats).getAllByRole("term");
    const definitions = within(stats).getAllByRole("definition");
    expect(terms.map((term) => term.textContent)).toEqual([
      translatePerson("stats.neighbors", { count: 5 }),
      translatePerson("stats.relationships", { count: 7 }),
      translatePerson("stats.characters", { count: 6 }),
    ]);
    expect(definitions.map((definition) => definition.textContent)).toEqual(["5", "7", "6"]);
  });

  it("keeps the counting note behind an info toggle instead of under the counters", async () => {
    renderDetails();

    expect(screen.queryByText(person.stats.caption)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: person.stats.about }));

    expect(await screen.findByText(person.stats.caption)).toBeVisible();
  });

  it("warns behind the info toggle that a partial map undercounts", async () => {
    renderDetails({ isPartial: true });

    expect(screen.queryByRole("button", { name: person.stats.about })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: person.stats.aboutPartial }));

    expect(await screen.findByText(person.stats.partial)).toBeVisible();
    expect(screen.queryByText(person.stats.caption)).not.toBeInTheDocument();
  });

  it("titles the panel with the character name", () => {
    renderDetails();

    expect(screen.getByRole("heading", { name: NODE.displayName })).toBeInTheDocument();
  });

  it("badges the map center and hides the make-center action", () => {
    renderDetails({ isRoot: true, onMakeCenter: null });

    expect(screen.getByText(person.root)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: person.makeCenter })).not.toBeInTheDocument();
  });

  it("offers a non-center character the make-center action instead of the badge", async () => {
    const onMakeCenter = vi.fn();
    renderDetails({ onMakeCenter });

    await userEvent.click(screen.getByRole("button", { name: person.makeCenter }));

    expect(onMakeCenter).toHaveBeenCalledOnce();
    expect(screen.queryByText(person.root)).not.toBeInTheDocument();
  });

  it("shows the importance of a central character", () => {
    renderDetails();

    expect(
      screen.getByText(translatePerson("importance", { label: importance.central })),
    ).toBeInTheDocument();
  });

  it("shows no importance badge when importance is not specified", () => {
    renderDetails({ node: makeRelationshipGraphNode({ importance: "not_specified" }) });

    expect(
      screen.queryByText(translatePerson("importance", { label: importance.not_specified })),
    ).not.toBeInTheDocument();
  });
});
