import type { CharacterGraphLayoutView } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { GraphReaderKey } from "./graph-workspace-request";

import {
  toGraphLayoutVersion,
  toRestoredGraphLayout,
  toSavedGraphPositions,
} from "./graph-workspace-signature";

const BOOK_ID = "8f2d5c3a-1b4e-4c6d-9a7b-2e3f4a5b6c7d";

const CHARACTER = {
  ciri: "c1c1c1c1-0000-4000-8000-000000000001",
  geralt: "9e9e9e9e-0000-4000-8000-000000000002",
  yennefer: "e1e1e1e1-0000-4000-8000-000000000003",
} as const;

const READER: GraphReaderKey = { currentPage: 120, finishedAt: null, readingStatus: "reading" };

const SAVED_VERSION = "workspace:1:0a1b2c3d4e5f6a7b";

const SAVED_LAYOUT: CharacterGraphLayoutView = {
  contextBookId: BOOK_ID,
  createdAt: "2026-01-05T10:00:00.000Z",
  id: "d4d4d4d4-0000-4000-8000-000000000001",
  layoutVersion: SAVED_VERSION,
  mode: "person",
  positions: {
    [CHARACTER.ciri]: { x: 140, y: 0 },
    [CHARACTER.geralt]: { x: 0, y: 0 },
  },
  scopeId: BOOK_ID,
  scopeType: "book",
  updatedAt: "2026-01-05T10:00:00.000Z",
  viewport: { x: 12, y: -8, zoom: 1.25 },
};

const VERSION_INPUT = {
  bookId: BOOK_ID,
  nodeIds: [CHARACTER.ciri, CHARACTER.geralt],
  reader: READER,
  sceneKey: "person",
};

describe("toRestoredGraphLayout", () => {
  it("restores nothing when the saved layout belongs to another layout version", () => {
    const restored = toRestoredGraphLayout({
      allowedIds: new Set([CHARACTER.ciri, CHARACTER.geralt]),
      layout: SAVED_LAYOUT,
      layoutVersion: "workspace:1:ffffffffffffffff",
    });

    expect(restored).toBeNull();
  });

  it("restores nothing when no layout was saved", () => {
    const restored = toRestoredGraphLayout({
      allowedIds: new Set([CHARACTER.geralt]),
      layout: null,
      layoutVersion: SAVED_VERSION,
    });

    expect(restored).toBeNull();
  });

  it("restores only the positions of the allowed characters, with the saved viewport", () => {
    const restored = toRestoredGraphLayout({
      allowedIds: new Set([CHARACTER.geralt]),
      layout: SAVED_LAYOUT,
      layoutVersion: SAVED_VERSION,
    });

    expect(restored).toEqual({
      positions: new Map([[CHARACTER.geralt, { x: 0, y: 0 }]]),
      viewport: { x: 12, y: -8, zoom: 1.25 },
    });
  });
});

describe("toSavedGraphPositions", () => {
  it("saves only the positions of the allowed characters", () => {
    const saved = toSavedGraphPositions({
      allowedIds: new Set([CHARACTER.geralt]),
      positions: new Map([
        [CHARACTER.ciri, { x: 1, y: 2 }],
        [CHARACTER.geralt, { x: 3, y: 4 }],
      ]),
    });

    expect(saved).toEqual({ [CHARACTER.geralt]: { x: 3, y: 4 } });
  });

  it("rounds coordinates to whole pixels", () => {
    const saved = toSavedGraphPositions({
      allowedIds: new Set([CHARACTER.ciri, CHARACTER.geralt]),
      positions: new Map([
        [CHARACTER.ciri, { x: 10.4, y: -3.6 }],
        [CHARACTER.geralt, { x: 99.5, y: 0.49 }],
      ]),
    });

    expect(saved).toEqual({
      [CHARACTER.ciri]: { x: 10, y: -4 },
      [CHARACTER.geralt]: { x: 100, y: 0 },
    });
  });
});

describe("toGraphLayoutVersion", () => {
  it.each<{ label: string; reader: GraphReaderKey }>([
    { label: "moves to another page", reader: { ...READER, currentPage: 121 } },
    { label: "finishes the book", reader: { ...READER, finishedAt: "2026-02-01T10:00:00.000Z" } },
    { label: "changes the reading status", reader: { ...READER, readingStatus: "paused" } },
  ])("changes when the reader $label", ({ reader }) => {
    const baseline = toGraphLayoutVersion(VERSION_INPUT);

    expect(toGraphLayoutVersion({ ...VERSION_INPUT, reader })).not.toBe(baseline);
  });

  it("changes when another character joins the scene", () => {
    const baseline = toGraphLayoutVersion(VERSION_INPUT);
    const nodeIds = [CHARACTER.ciri, CHARACTER.geralt, CHARACTER.yennefer];

    expect(toGraphLayoutVersion({ ...VERSION_INPUT, nodeIds })).not.toBe(baseline);
  });

  it("stays the same for the same characters listed in another order", () => {
    const baseline = toGraphLayoutVersion(VERSION_INPUT);
    const nodeIds = [CHARACTER.geralt, CHARACTER.ciri];

    expect(toGraphLayoutVersion({ ...VERSION_INPUT, nodeIds })).toBe(baseline);
  });
});
