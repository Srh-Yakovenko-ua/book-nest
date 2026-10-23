"use client";

import type { Nullable } from "@app/shared";

import {
  CHARACTER_GRAPH_DEPTH_MAX,
  CHARACTER_GRAPH_DEPTH_MIN,
  FAMILY_TREE_GENERATIONS,
} from "@app/shared";
import { Route } from "lucide-react";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { RelationshipParticipant } from "../../model/relationship-form-schema";
import type { TreeOptionKey, TreeOptions } from "../../model/workspace/graph-tree-scene";
import type {
  GraphWorkspaceParams,
  NetworkGrouping,
} from "../../model/workspace/graph-workspace-params";
import type { GraphWorkspaceState } from "../../model/workspace/use-graph-workspace-state";

import { TREE_OPTION_KEYS } from "../../model/workspace/graph-tree-scene";
import { NETWORK_GROUPINGS } from "../../model/workspace/graph-workspace-params";
import { RelationshipParticipantPicker } from "../relationship-participant-picker";
import { GraphWorkspaceFilters } from "./graph-workspace-filters";

const TOOLBAR = {
  depthOptions: Array.from(
    { length: CHARACTER_GRAPH_DEPTH_MAX - CHARACTER_GRAPH_DEPTH_MIN + 1 },
    (_, index) => CHARACTER_GRAPH_DEPTH_MIN + index,
  ),
  generationOptions: Array.from(
    { length: FAMILY_TREE_GENERATIONS.max - FAMILY_TREE_GENERATIONS.min + 1 },
    (_, index) => FAMILY_TREE_GENERATIONS.min + index,
  ),
  pickerId: "graph-workspace-root-picker",
} as const;

type GraphWorkspaceToolbarProps = {
  actions: GraphWorkspaceState["actions"];
  bookId: string;
  onTreeOptionsChange: (options: TreeOptions) => void;
  params: GraphWorkspaceParams;
  rootParticipant: Nullable<RelationshipParticipant>;
  treeOptions: TreeOptions;
};

export function GraphWorkspaceToolbar({
  actions,
  bookId,
  onTreeOptionsChange,
  params,
  rootParticipant,
  treeOptions,
}: GraphWorkspaceToolbarProps) {
  const t = useTranslations("relationships.workspace");
  const usesRoot = params.view !== "network";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {usesRoot ? (
        <div className="flex w-full min-w-0 items-center gap-1 sm:w-72">
          <label className="sr-only" htmlFor={TOOLBAR.pickerId}>
            {t("picker.label")}
          </label>
          <RelationshipParticipantPicker
            bookId={bookId}
            excludedIds={[]}
            id={TOOLBAR.pickerId}
            invalid={false}
            onBlur={() => undefined}
            onChange={(participant) => actions.chooseCharacter(participant.id)}
            value={rootParticipant}
          />
          {params.characterId === null ? null : (
            <Button
              aria-label={t("picker.clear")}
              onClick={actions.clearCharacter}
              size="icon"
              type="button"
              variant="ghost"
            >
              <UiIcon name="x" size={16} />
            </Button>
          )}
        </div>
      ) : null}
      {params.view === "person" ? (
        <Select
          disabled={params.characterId === null}
          onValueChange={(value) => actions.setDepth(Number(value))}
          value={String(params.depth)}
        >
          <SelectTrigger aria-label={t("depth.label")} className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TOOLBAR.depthOptions.map((depth) => (
              <SelectItem key={depth} value={String(depth)}>
                {t("depth.option", { depth })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {params.view === "tree" ? (
        <>
          <GenerationsControl actions={actions} params={params} />
          <TreeOptionsControl onChange={onTreeOptionsChange} options={treeOptions} />
        </>
      ) : null}
      {params.view === "network" ? (
        <Select
          onValueChange={(value) => {
            const grouping = NETWORK_GROUPINGS.find((entry) => entry === value);
            if (grouping !== undefined) actions.setNetworkGroup(grouping);
          }}
          value={params.networkGroup}
        >
          <SelectTrigger aria-label={t("grouping.label")} className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NETWORK_GROUPINGS.map((grouping: NetworkGrouping) => (
              <SelectItem key={grouping} value={grouping}>
                {t(`grouping.${grouping}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <GraphWorkspaceFilters
        categories={params.categories}
        disabled={params.view === "tree"}
        onChange={actions.setFilters}
        onReset={actions.resetFilters}
        types={params.types}
      />
      <Button
        onClick={() => actions.openPath(params.view === "network" ? null : params.characterId)}
        type="button"
        variant="secondary"
      >
        <Route aria-hidden className="size-4" />
        {t("pathEntry")}
      </Button>
      <HelpControl />
    </div>
  );
}

function GenerationsControl({
  actions,
  params,
}: {
  actions: GraphWorkspaceState["actions"];
  params: GraphWorkspaceParams;
}) {
  const t = useTranslations("relationships.workspace.generations");
  const setGeneration = (key: "treeDown" | "treeUp", value: string) =>
    actions.setGenerations({
      treeDown: key === "treeDown" ? Number(value) : params.treeDown,
      treeUp: key === "treeUp" ? Number(value) : params.treeUp,
    });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button disabled={params.characterId === null} type="button" variant="outline">
          {t("trigger", { down: params.treeDown, up: params.treeUp })}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-64 flex-col gap-3">
        {(["treeUp", "treeDown"] as const).map((key) => (
          <div className="flex items-center justify-between gap-3" key={key}>
            <span className="text-sm">{t(key === "treeUp" ? "ancestors" : "descendants")}</span>
            <Select
              onValueChange={(value) => setGeneration(key, value)}
              value={String(params[key])}
            >
              <SelectTrigger
                aria-label={t(key === "treeUp" ? "ancestors" : "descendants")}
                className="w-36"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOOLBAR.generationOptions.map((count) => (
                  <SelectItem key={count} value={String(count)}>
                    {t("option", { count })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function HelpControl() {
  const t = useTranslations("relationships.workspace.help");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button aria-label={t("trigger")} size="icon" type="button" variant="ghost">
          <UiIcon name="help-circle" size={18} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 flex-col gap-2 text-sm">
        <p className="font-medium">{t("title")}</p>
        <p className="text-muted-foreground">{t("depth")}</p>
        <p className="text-muted-foreground">{t("filters")}</p>
        <p className="text-muted-foreground">{t("click")}</p>
        <p className="text-muted-foreground">{t("spoilers")}</p>
      </PopoverContent>
    </Popover>
  );
}

function TreeOptionsControl({
  onChange,
  options,
}: {
  onChange: (options: TreeOptions) => void;
  options: TreeOptions;
}) {
  const t = useTranslations("relationships.workspace.treeOptions");
  const toggle = (key: TreeOptionKey, checked: boolean) => onChange({ ...options, [key]: checked });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline">
          {t("trigger")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-72 flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t("lineage")}</p>
        {TREE_OPTION_KEYS.map((key) => (
          <div className="flex items-center gap-2" key={key}>
            <Checkbox
              checked={options[key]}
              id={`tree-option-${key}`}
              onCheckedChange={(checked) => toggle(key, checked === true)}
            />
            <Label htmlFor={`tree-option-${key}`}>{t(key)}</Label>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">{t("partners")}</p>
      </PopoverContent>
    </Popover>
  );
}
