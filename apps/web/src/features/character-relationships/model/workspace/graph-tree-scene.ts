import type {
  CharacterGraphEdgeView,
  CharacterGraphNodeView,
  FamilyTreeGraphView,
  FamilyTreeLineageKind,
  RelationshipType,
} from "@app/shared";

export const TREE_OPTION_KEYS = [
  "marriages",
  "siblings",
  "guardians",
  "distant",
  "exUnions",
] as const;

export type TreeEdgeEntry =
  | {
      childId: string;
      edge: CharacterGraphEdgeView;
      kind: "lineage";
      lineageKind: FamilyTreeLineageKind;
      parentId: string;
    }
  | { edge: CharacterGraphEdgeView; group: TreeOptionKey; kind: "auxiliary" }
  | { edge: CharacterGraphEdgeView; kind: "conflict" };

export type TreeLineageLink = {
  childId: string;
  edgeId: string;
  kind: FamilyTreeLineageKind;
  parentId: string;
};

export type TreeOptionKey = (typeof TREE_OPTION_KEYS)[number];

export type TreeOptions = Readonly<Record<TreeOptionKey, boolean>>;

export type TreeReach = {
  ancestors: number;
  descendants: number;
};

export type TreeScene = {
  edges: CharacterGraphEdgeView[];
  entryByEdgeId: ReadonlyMap<string, TreeEdgeEntry>;
  generationById: ReadonlyMap<string, number>;
  hasConflicts: boolean;
  hasMultiLineLinks: boolean;
  lineage: readonly TreeLineageLink[];
  nodes: CharacterGraphNodeView[];
  reach: TreeReach;
  rootId: string;
  rowById: ReadonlyMap<string, number>;
  sideAnchorById: ReadonlyMap<string, string>;
};

export const TREE_SCENE = {
  defaultOptions: {
    distant: true,
    exUnions: false,
    guardians: true,
    marriages: true,
    siblings: true,
  },
  lineageTypes: [
    "adoptive_child_of",
    "adoptive_parent_of",
    "biological_child_of",
    "biological_parent_of",
    "step_child_of",
    "step_parent_of",
  ],
  optionTypes: {
    distant: ["ancestor_of", "descendant_of", "relative_of", "custom"],
    exUnions: ["ex_spouse_of"],
    guardians: ["guardian_of", "ward_of"],
    marriages: ["spouse_of"],
    siblings: ["sibling_of", "half_sibling_of", "step_sibling_of", "twin_of"],
  },
} as const satisfies {
  defaultOptions: TreeOptions;
  lineageTypes: readonly RelationshipType[];
  optionTypes: Record<TreeOptionKey, readonly RelationshipType[]>;
};

export function buildTreeScene({
  options,
  tree,
}: {
  options: TreeOptions;
  tree: FamilyTreeGraphView;
}): TreeScene {
  const rootId = tree.focusCharacterId;
  const nodeIds = new Set(tree.nodes.map((node) => node.id));
  const lineage = tree.lineage
    .filter((link) => nodeIds.has(link.parentId) && nodeIds.has(link.childId))
    .map((link): TreeLineageLink => ({
      childId: link.childId,
      edgeId: link.relationshipId,
      kind: link.kind,
      parentId: link.parentId,
    }));
  const layering = toTreeGenerations({ lineage, rootId });
  const entries = toEdgeEntries({ edges: tree.edges, lineage });
  const candidates = entries.filter((entry) => entry.kind !== "auxiliary" || options[entry.group]);
  const { rowById, sideAnchorById } = anchorSideRelatives({
    entries: candidates,
    generationById: layering.generationById,
  });
  const visibleEntries = candidates.filter(
    (entry) => rowById.has(entry.edge.source) && rowById.has(entry.edge.target),
  );
  const visibleGenerations = [...layering.generationById.values()];

  return {
    edges: visibleEntries.map((entry) => entry.edge),
    entryByEdgeId: new Map(visibleEntries.map((entry) => [entry.edge.id, entry] as const)),
    generationById: layering.generationById,
    hasConflicts:
      tree.diagnostics.length > 0 || visibleEntries.some((entry) => entry.kind === "conflict"),
    hasMultiLineLinks: layering.hasMultiLineLinks,
    lineage,
    nodes: tree.nodes.filter((node) => rowById.has(node.id)),
    reach: {
      ancestors: Math.max(0, -Math.min(0, ...visibleGenerations)),
      descendants: Math.max(0, ...visibleGenerations),
    },
    rootId,
    rowById,
    sideAnchorById,
  };
}

export function countEnabledTreeOptions(options: TreeOptions): number {
  return TREE_OPTION_KEYS.filter((key) => options[key]).length;
}

export function toTreeGenerations({
  lineage,
  rootId,
}: {
  lineage: readonly TreeLineageLink[];
  rootId: string;
}): { generationById: ReadonlyMap<string, number>; hasMultiLineLinks: boolean } {
  const generationById = new Map<string, number>([[rootId, 0]]);
  let frontier = [rootId];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      const generation = generationById.get(id) ?? 0;
      for (const link of lineage) {
        if (link.childId === id && !generationById.has(link.parentId)) {
          generationById.set(link.parentId, generation - 1);
          next.push(link.parentId);
        }
        if (link.parentId === id && !generationById.has(link.childId)) {
          generationById.set(link.childId, generation + 1);
          next.push(link.childId);
        }
      }
    }
    frontier = next.sort();
  }

  const layered = new Map(generationById);
  const ranked = lineage.filter((link) => layered.has(link.parentId) && layered.has(link.childId));
  const maxPasses = layered.size * 2 + 2;
  let settled = false;
  for (let pass = 0; pass < maxPasses && !settled; pass += 1) {
    settled = true;
    for (const link of ranked) {
      const parent = layered.get(link.parentId) ?? 0;
      const child = layered.get(link.childId) ?? 0;
      if (child - parent >= 1) continue;
      settled = false;
      if (child <= 0 && link.parentId !== rootId) {
        layered.set(link.parentId, child - 1);
      } else if (link.childId !== rootId) {
        layered.set(link.childId, parent + 1);
      }
    }
  }
  if (!settled) return { generationById, hasMultiLineLinks: true };
  return {
    generationById: layered,
    hasMultiLineLinks: ranked.some(
      (link) => (layered.get(link.childId) ?? 0) - (layered.get(link.parentId) ?? 0) > 1,
    ),
  };
}

export function toTreeOptionGroup(type: RelationshipType): TreeOptionKey | undefined {
  return TREE_OPTION_KEYS.find((key) =>
    TREE_SCENE.optionTypes[key].some((candidate) => candidate === type),
  );
}

function anchorSideRelatives({
  entries,
  generationById,
}: {
  entries: readonly TreeEdgeEntry[];
  generationById: ReadonlyMap<string, number>;
}): { rowById: ReadonlyMap<string, number>; sideAnchorById: ReadonlyMap<string, string> } {
  const rowById = new Map(generationById);
  const sideAnchorById = new Map<string, string>();
  const pending = [...entries].sort((left, right) => left.edge.id.localeCompare(right.edge.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of pending) {
      const { source, target } = entry.edge;
      const sourceRow = rowById.get(source);
      const targetRow = rowById.get(target);
      if (sourceRow === undefined && targetRow !== undefined) {
        rowById.set(source, targetRow);
        sideAnchorById.set(source, target);
        changed = true;
      }
      if (targetRow === undefined && sourceRow !== undefined) {
        rowById.set(target, sourceRow);
        sideAnchorById.set(target, source);
        changed = true;
      }
    }
  }
  return { rowById, sideAnchorById };
}

function isLineageType(type: RelationshipType): boolean {
  return TREE_SCENE.lineageTypes.some((candidate) => candidate === type);
}

function toEdgeEntries({
  edges,
  lineage,
}: {
  edges: readonly CharacterGraphEdgeView[];
  lineage: readonly TreeLineageLink[];
}): TreeEdgeEntry[] {
  const linkByEdgeId = new Map(lineage.map((link) => [link.edgeId, link] as const));
  return edges.flatMap((edge): TreeEdgeEntry[] => {
    if (edge.source === edge.target) return [];
    const link = linkByEdgeId.get(edge.id);
    if (link !== undefined) {
      return [
        {
          childId: link.childId,
          edge,
          kind: "lineage",
          lineageKind: link.kind,
          parentId: link.parentId,
        },
      ];
    }
    if (edge.typeHidden || edge.type === null) return [];
    if (isLineageType(edge.type)) return [{ edge, kind: "conflict" }];
    const group = toTreeOptionGroup(edge.type);
    return group === undefined ? [] : [{ edge, group, kind: "auxiliary" }];
  });
}
