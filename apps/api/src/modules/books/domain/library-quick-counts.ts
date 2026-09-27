import type { LibraryQuickCountScope, LibraryQuickFilterKey } from "@app/shared";

import type { LibraryFilter } from "../infrastructure/book-where.js";

import { intersectOwnership, LIBRARY_OVERVIEW } from "./library-overview.js";

const LIBRARY_QUICK_FILTER_AXES = [
  "bookType",
  "isFavorite",
  "ownershipStatuses",
  "readingStatuses",
] as const;

export type LibraryQuickCountFilters = Record<LibraryQuickFilterKey, LibraryFilter>;

export type LibraryQuickCountTotals = Record<LibraryQuickFilterKey, number>;

type LibraryQuickCountsConfig = {
  readonly overlays: Readonly<Record<LibraryQuickFilterKey, LibraryQuickFilterOverlay>>;
  readonly scopeBases: Readonly<Record<LibraryQuickCountScope, LibraryQuickFilterOverlay>>;
};

type LibraryQuickFilterAxis = (typeof LIBRARY_QUICK_FILTER_AXES)[number];

type LibraryQuickFilterOverlay = Partial<Pick<LibraryFilter, LibraryQuickFilterAxis>>;

export const LIBRARY_QUICK_COUNTS: LibraryQuickCountsConfig = {
  overlays: {
    all: {},
    borrowed: { ownershipStatuses: LIBRARY_OVERVIEW.borrowedStatuses },
    favorites: { isFavorite: true },
    finished: { readingStatuses: LIBRARY_OVERVIEW.finishedStatuses },
    in_transit: { ownershipStatuses: LIBRARY_OVERVIEW.inTransitStatuses },
    reading: { readingStatuses: LIBRARY_OVERVIEW.readingInProgressStatuses },
    series: { bookType: "series_part" },
    solo: { bookType: "solo" },
    want_to_buy: { ownershipStatuses: LIBRARY_OVERVIEW.wantToBuyStatuses },
    want_to_read: { readingStatuses: LIBRARY_OVERVIEW.wantToReadStatuses },
  },
  scopeBases: {
    all: {},
    favorites: { isFavorite: true },
    my: { ownershipStatuses: LIBRARY_OVERVIEW.physicalOwnershipStatuses },
  },
};

export function buildLibraryQuickCountFilters({
  filter,
  scope,
}: {
  filter: LibraryFilter;
  scope: LibraryQuickCountScope;
}): LibraryQuickCountFilters {
  const base: LibraryFilter = {
    ...clearLibraryQuickFilterAxes(filter),
    ...LIBRARY_QUICK_COUNTS.scopeBases[scope],
  };
  const { overlays } = LIBRARY_QUICK_COUNTS;
  return {
    all: applyOverlay({ base, overlay: overlays.all }),
    borrowed: applyOverlay({ base, overlay: overlays.borrowed }),
    favorites: applyOverlay({ base, overlay: overlays.favorites }),
    finished: applyOverlay({ base, overlay: overlays.finished }),
    in_transit: applyOverlay({ base, overlay: overlays.in_transit }),
    reading: applyOverlay({ base, overlay: overlays.reading }),
    series: applyOverlay({ base, overlay: overlays.series }),
    solo: applyOverlay({ base, overlay: overlays.solo }),
    want_to_buy: applyOverlay({ base, overlay: overlays.want_to_buy }),
    want_to_read: applyOverlay({ base, overlay: overlays.want_to_read }),
  };
}

export function clearLibraryQuickFilterAxes(filter: LibraryFilter): LibraryFilter {
  const cleared: LibraryFilter = { ...filter };
  for (const axis of LIBRARY_QUICK_FILTER_AXES) {
    delete cleared[axis];
  }
  return cleared;
}

function applyOverlay({
  base,
  overlay,
}: {
  base: LibraryFilter;
  overlay: LibraryQuickFilterOverlay;
}): LibraryFilter {
  const combined: LibraryFilter = { ...base, ...overlay };
  if (overlay.ownershipStatuses !== undefined) {
    combined.ownershipStatuses = intersectOwnership({
      allowed: overlay.ownershipStatuses,
      scope: base.ownershipStatuses,
    });
  }
  return combined;
}
