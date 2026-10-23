import type {
  CharacterGraphEdgeView,
  CharacterGraphNodeView,
  FamilyTreeGraphView,
  RelationshipType,
} from "@app/shared";

export const TREE_OPTION_KEYS = [
  "marriages",
  "siblings",
  "guardians",
  "distant",
  "exUnions",
] as const;

export type TreeEdgeRole = "auxiliary" | "lineage";

export type TreeOptionKey = (typeof TREE_OPTION_KEYS)[number];

export type TreeOptions = Readonly<Record<TreeOptionKey, boolean>>;

export type TreeScene = {
  edges: CharacterGraphEdgeView[];
  generationById: ReadonlyMap<string, number>;
  hasIrregularGenerations: boolean;
  lineageParentsById: ReadonlyMap<string, readonly string[]>;
  nodes: CharacterGraphNodeView[];
  roleByEdgeId: ReadonlyMap<string, TreeEdgeRole>;
  rootId: string;
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
  optionTypes: {
    distant: ["ancestor_of", "descendant_of", "relative_of", "custom"],
    exUnions: ["ex_spouse_of"],
    guardians: ["guardian_of", "ward_of"],
    marriages: ["spouse_of"],
    siblings: ["sibling_of", "half_sibling_of", "step_sibling_of", "twin_of"],
  },
  unrankedLineageTypes: [
    "adoptive_child_of",
    "adoptive_parent_of",
    "biological_child_of",
    "biological_parent_of",
    "step_child_of",
    "step_parent_of",
  ],
} as const satisfies {
  defaultOptions: TreeOptions;
  optionTypes: Record<TreeOptionKey, readonly RelationshipType[]>;
  unrankedLineageTypes: readonly RelationshipType[];
};

export function buildTreeScene({
  options,
  tree,
}: {
  options: TreeOptions;
  tree: FamilyTreeGraphView;
}): TreeScene {
  const rootId = tree.focusCharacterId;
  const lineageEdgeIds = new Set(tree.lineage.map((link) => link.relationshipId));
  const generationById = toGenerations({ lineage: tree.lineage, rootId });
  const enabledTypes = new Set<RelationshipType>([
    ...TREE_SCENE.unrankedLineageTypes,
    ...TREE_OPTION_KEYS.filter((key) => options[key]).flatMap((key) => TREE_SCENE.optionTypes[key]),
  ]);

  const roleByEdgeId = new Map<string, TreeEdgeRole>();
  const sideAnchorById = new Map<string, string>();
  const edges: CharacterGraphEdgeView[] = [];
  for (const edge of tree.edges) {
    if (lineageEdgeIds.has(edge.id)) {
      if (!generationById.has(edge.source) || !generationById.has(edge.target)) continue;
      roleByEdgeId.set(edge.id, "lineage");
      edges.push(edge);
      continue;
    }
    if (edge.type === null || !enabledTypes.has(edge.type)) continue;
    const sourceRanked = generationById.has(edge.source);
    const targetRanked = generationById.has(edge.target);
    if (!sourceRanked && !targetRanked) continue;
    if (!sourceRanked && !sideAnchorById.has(edge.source)) {
      sideAnchorById.set(edge.source, edge.target);
    }
    if (!targetRanked && !sideAnchorById.has(edge.target)) {
      sideAnchorById.set(edge.target, edge.source);
    }
    roleByEdgeId.set(edge.id, "auxiliary");
    edges.push(edge);
  }

  const visibleIds = new Set([...generationById.keys(), ...sideAnchorById.keys()]);
  const lineageParentsById = new Map<string, string[]>();
  for (const link of tree.lineage) {
    const parents = lineageParentsById.get(link.childId) ?? [];
    parents.push(link.parentId);
    lineageParentsById.set(link.childId, parents);
  }

  return {
    edges,
    generationById,
    hasIrregularGenerations:
      tree.diagnostics.length > 0 ||
      tree.lineage.some(
        (link) =>
          (generationById.get(link.childId) ?? 0) - (generationById.get(link.parentId) ?? 0) !== 1,
      ),
    lineageParentsById,
    nodes: tree.nodes.filter((node) => visibleIds.has(node.id)),
    roleByEdgeId,
    rootId,
    sideAnchorById,
  };
}

function toGenerations({
  lineage,
  rootId,
}: {
  lineage: FamilyTreeGraphView["lineage"];
  rootId: string;
}): ReadonlyMap<string, number> {
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
  return generationById;
}
