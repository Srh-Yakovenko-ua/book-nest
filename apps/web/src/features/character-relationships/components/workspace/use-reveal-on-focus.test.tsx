import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { useRevealOnFocus } from "./use-reveal-on-focus";

const flow = vi.hoisted(() => ({
  getNode: vi.fn(),
  getZoom: vi.fn(),
  setCenter: vi.fn(),
}));

vi.mock("@xyflow/react", () => ({ useReactFlow: () => flow }));

const GRAPH = {
  card: "Rhaenyra Targaryen",
  flowWrapper: "react-flow",
  miniMap: "Mini map",
  miniMapPanel: "react-flow__minimap",
  node: {
    data: {},
    id: "0c0c0c0c-0000-4000-8000-000000000021",
    position: { x: 240, y: 520 },
  },
  pane: "Graph",
  zoom: 1.5,
} as const;

type CardFocusSetup = {
  cardTop: number;
  isFocusVisible?: boolean;
  miniMapTop?: number;
  paneScrollTop?: number;
};

function focusCard({
  cardTop,
  isFocusVisible = true,
  miniMapTop,
  paneScrollTop = 0,
}: CardFocusSetup) {
  renderWithProviders(<RevealingCard />);
  const pane = screen.getByRole("region", { name: GRAPH.pane });
  pane.classList.add(GRAPH.flowWrapper);
  const card = screen.getByRole("button", { name: GRAPH.card });
  const measureCard = () => new DOMRect(100 - pane.scrollLeft, cardTop - pane.scrollTop, 120, 60);
  pane.scrollTop = paneScrollTop;
  vi.spyOn(pane, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 400, 300));
  vi.spyOn(card, "getBoundingClientRect").mockImplementation(measureCard);
  vi.spyOn(card, "matches").mockImplementation(
    (selector: string) => isFocusVisible && selector === ":focus-visible",
  );
  if (miniMapTop !== undefined) {
    const miniMap = screen.getByRole("figure", { name: GRAPH.miniMap });
    const measureMiniMap = () => new DOMRect(150, miniMapTop - pane.scrollTop, 200, 100);
    miniMap.classList.add(GRAPH.miniMapPanel);
    vi.spyOn(miniMap, "getBoundingClientRect").mockImplementation(measureMiniMap);
  }

  act(() => card.focus());
}

function RevealingCard() {
  const revealOnFocus = useRevealOnFocus(GRAPH.node.id);

  return (
    <section aria-label={GRAPH.pane}>
      <button onFocus={revealOnFocus} type="button">
        {GRAPH.card}
      </button>
      <figure aria-label={GRAPH.miniMap} />
    </section>
  );
}

describe("useRevealOnFocus", () => {
  beforeEach(() => {
    flow.getNode.mockImplementation((id: string) =>
      id === GRAPH.node.id ? GRAPH.node : undefined,
    );
    flow.getZoom.mockReturnValue(GRAPH.zoom);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("centers the camera on a card that keyboard focus reached below the pane", () => {
    focusCard({ cardTop: 350 });

    expect(flow.setCenter).toHaveBeenCalledExactlyOnceWith(
      GRAPH.node.position.x,
      GRAPH.node.position.y,
      { duration: 0, zoom: GRAPH.zoom },
    );
  });

  it("centers the camera on a card below the pane even after the browser scrolled the pane to it", () => {
    focusCard({ cardTop: 350, paneScrollTop: 300 });

    expect(flow.setCenter).toHaveBeenCalledExactlyOnceWith(
      GRAPH.node.position.x,
      GRAPH.node.position.y,
      { duration: 0, zoom: GRAPH.zoom },
    );
  });

  it("centers the camera on a card under the minimap even after the browser scrolled the pane", () => {
    focusCard({ cardTop: 220, miniMapTop: 200, paneScrollTop: 300 });

    expect(flow.setCenter).toHaveBeenCalledExactlyOnceWith(
      GRAPH.node.position.x,
      GRAPH.node.position.y,
      { duration: 0, zoom: GRAPH.zoom },
    );
  });

  it("leaves the camera alone when the focused card is fully inside the pane", () => {
    focusCard({ cardTop: 100 });

    expect(flow.setCenter).not.toHaveBeenCalled();
  });

  it("leaves the camera alone when the card got focus without a visible focus ring", () => {
    focusCard({ cardTop: 350, isFocusVisible: false });

    expect(flow.setCenter).not.toHaveBeenCalled();
  });
});
