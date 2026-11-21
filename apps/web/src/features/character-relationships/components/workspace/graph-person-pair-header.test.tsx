import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen } from "@/test-utils";

import type { GraphPairSemantics } from "../../model/workspace/graph-person-semantics";

import {
  makeRelationshipGraphEdge,
  makeRelationshipGraphNode,
} from "../../model/relationships.fixtures";
import { GraphPersonPairHeader } from "./graph-person-pair-header";

const translatePanel = createTranslator({
  locale: "uk",
  messages,
  namespace: "relationships.workspace.panel",
});

const FIRST = makeRelationshipGraphNode({ id: "first", name: "Yennefer" });

const SECOND = makeRelationshipGraphNode({ id: "second", name: "Ciri" });

const DIRECTED: GraphPairSemantics = {
  direction: { kind: "directed", sourceId: SECOND.id, targetId: FIRST.id },
  relationshipCount: 1,
  singleEdge: makeRelationshipGraphEdge({ source: SECOND.id, target: FIRST.id }),
  tone: "family",
};

function nameOf(id: string): string {
  return [FIRST, SECOND].find((node) => node.id === id)?.displayName ?? "";
}

function renderHeader(semantics: GraphPairSemantics) {
  renderWithProviders(
    <GraphPersonPairHeader first={FIRST} nameOf={nameOf} second={SECOND} semantics={semantics} />,
  );
}

describe("GraphPersonPairHeader", () => {
  it("names the pair in its heading and shows each name only once", () => {
    renderHeader(DIRECTED);

    expect(
      screen.getByRole("heading", {
        name: translatePanel("connection.title", { source: FIRST.name, target: SECOND.name }),
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(FIRST.name)).toHaveLength(1);
    expect(screen.getAllByText(SECOND.name)).toHaveLength(1);
  });

  it("leaves the direction to screen readers instead of repeating both names on screen", () => {
    renderHeader(DIRECTED);

    const direction = screen.getAllByText(
      translatePanel("person.direction.directed", { source: SECOND.name, target: FIRST.name }),
    );
    const [line] = direction;
    expect(direction).toHaveLength(1);
    expect(line).toHaveClass("sr-only");
  });

  it("keeps the direction of a masked pair unsaid", () => {
    renderHeader({ ...DIRECTED, singleEdge: null, tone: "masked" });

    expect(
      screen.queryByText(
        translatePanel("person.direction.directed", { source: SECOND.name, target: FIRST.name }),
      ),
    ).not.toBeInTheDocument();
  });
});
