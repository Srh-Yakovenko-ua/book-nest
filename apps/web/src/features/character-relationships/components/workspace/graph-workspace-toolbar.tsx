"use client";

import type { Nullable } from "@app/shared";

import {
  CHARACTER_GRAPH_DEPTH_MAX,
  CHARACTER_GRAPH_DEPTH_MIN,
  FAMILY_TREE_GENERATIONS,
} from "@app/shared";
import {
  Lock,
  RotateCcw,
  Route,
  SlidersHorizontal,
  TriangleAlert,
  UnfoldVertical,
  UsersRound,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type { RelationshipParticipant } from "../../model/relationship-form-schema";
import type { TreeOptionKey, TreeOptions } from "../../model/workspace/graph-tree-scene";
import type {
  GraphWorkspaceParams,
  NetworkGrouping,
} from "../../model/workspace/graph-workspace-params";
import type { GraphWorkspaceState } from "../../model/workspace/use-graph-workspace-state";
import type { GraphGenealogyBarProps } from "./graph-genealogy-bar";
import type { GraphNetworkSearchProps } from "./graph-network-search";
import type { WorkspaceWidthClass } from "./use-workspace-width-class";

import {
  countEnabledTreeOptions,
  TREE_OPTION_KEYS,
  TREE_SCENE,
} from "../../model/workspace/graph-tree-scene";
import { GRAPH_TREE_SCOPES, NETWORK_GROUPINGS } from "../../model/workspace/graph-workspace-params";
import { RelationshipParticipantPicker } from "../relationship-participant-picker";
import { GraphGenealogyBar } from "./graph-genealogy-bar";
import { GraphNetworkSearch } from "./graph-network-search";
import { GraphWorkspaceFilters } from "./graph-workspace-filters";
import { useIsShortViewport } from "./use-is-short-viewport";

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

export type GraphToolbarGenealogy = Omit<GraphGenealogyBarProps, "compact"> & {
  collapsedBranches: number;
  hiddenCount: number;
  onExpandAll: () => void;
};

export type GraphToolbarNetworkSearch = Omit<GraphNetworkSearchProps, "compact">;

type GraphWorkspaceToolbarProps = {
  actions: GraphWorkspaceState["actions"];
  bookId: string;
  filtersTriggerId: string;
  genealogy: Nullable<GraphToolbarGenealogy>;
  networkSearch: Nullable<GraphToolbarNetworkSearch>;
  onTreeOptionsChange: (options: TreeOptions) => void;
  onTreeOptionsReset: () => void;
  params: GraphWorkspaceParams;
  rootParticipant: Nullable<RelationshipParticipant>;
  treeOptions: TreeOptions;
  widthClass: WorkspaceWidthClass;
};

export function GraphTreeScopeSwitch({
  actions,
  params,
}: {
  actions: GraphWorkspaceState["actions"];
  params: GraphWorkspaceParams;
}) {
  const t = useTranslations("relationships.workspace.treeScope");

  return (
    <Segmented
      label={t("label")}
      onValueChange={(value) => {
        const treeScope = GRAPH_TREE_SCOPES.find((scope) => scope === value);
        if (treeScope !== undefined) {
          actions.setTreeScope({ characterId: params.characterId, treeScope });
        }
      }}
      options={GRAPH_TREE_SCOPES.map((scope) => ({ label: t(scope), value: scope }))}
      value={params.treeScope}
    />
  );
}

export function GraphWorkspaceToolbar({
  actions,
  bookId,
  filtersTriggerId,
  genealogy,
  networkSearch,
  onTreeOptionsChange,
  onTreeOptionsReset,
  params,
  rootParticipant,
  treeOptions,
  widthClass,
}: GraphWorkspaceToolbarProps) {
  const t = useTranslations("relationships.workspace");
  const isShort = useIsShortViewport();
  const isTree = params.view === "tree";
  const isGenealogy = isTree && params.treeScope === "full";
  const usesRoot = params.view !== "network" && !isGenealogy;
  const grouped = isTree && (isShort || widthClass === "compact");
  const openPath = () => actions.openPath(params.view === "network" ? null : params.characterId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {genealogy === null ? null : (
        <GraphGenealogyBar {...genealogy} compact={grouped && widthClass === "compact"} />
      )}
      {usesRoot ? (
        <div className="flex w-full min-w-0 items-center gap-1 sm:w-72">
          <label className="sr-only" htmlFor={TOOLBAR.pickerId}>
            {t("picker.label")}
          </label>
          <div className="min-w-0 flex-1">
            <RelationshipParticipantPicker
              bookId={bookId}
              excludedIds={[]}
              id={TOOLBAR.pickerId}
              invalid={false}
              onBlur={() => undefined}
              onChange={(participant) => actions.chooseCharacter(participant.id)}
              value={rootParticipant}
            />
          </div>
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
        <div className="flex items-center gap-2">
          <span aria-hidden className="hidden text-sm text-muted-foreground @3xl/workspace:inline">
            {t("depth.label")}
          </span>
          <Segmented
            disabled={params.characterId === null}
            label={t("depth.label")}
            onValueChange={(value) => actions.setDepth(Number(value))}
            options={TOOLBAR.depthOptions.map((depth) => ({
              label: t("depth.short", { depth }),
              value: String(depth),
            }))}
            value={String(params.depth)}
          />
        </div>
      ) : null}
      {isTree ? (
        <>
          {isGenealogy ? null : <GenerationsControl actions={actions} params={params} />}
          <TreeOptionsControl
            compact={grouped && widthClass === "compact"}
            onChange={onTreeOptionsChange}
            onReset={onTreeOptionsReset}
            options={treeOptions}
          />
        </>
      ) : null}
      {params.view === "network" ? (
        <>
          {networkSearch === null ? null : (
            <GraphNetworkSearch {...networkSearch} compact={widthClass === "compact"} />
          )}
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
        </>
      ) : null}
      {params.view === "tree" ? null : (
        <GraphWorkspaceFilters
          categories={params.categories}
          onChange={actions.setFilters}
          onReset={actions.resetFilters}
          triggerId={filtersTriggerId}
          types={params.types}
        />
      )}
      {grouped ? (
        <MoreActions genealogy={genealogy} onOpenPath={openPath} />
      ) : (
        <>
          {genealogy === null ? null : <ExpandAllButton genealogy={genealogy} />}
          <Button onClick={openPath} type="button" variant="secondary">
            <Route aria-hidden className="size-4" />
            {t(params.view === "network" ? "pathEntry" : "pathEntryShort")}
          </Button>
        </>
      )}
      <HelpControl isGenealogy={isGenealogy} view={params.view} />
    </div>
  );
}

function ExpandAllButton({ genealogy }: { genealogy: GraphToolbarGenealogy }) {
  const t = useTranslations("relationships.workspace.genealogy.bar");
  const { collapsedBranches, hiddenCount, onExpandAll } = genealogy;
  const isInert = collapsedBranches === 0;

  return (
    <Button
      aria-disabled={isInert}
      aria-label={
        isInert
          ? t("expandAll")
          : t("expandAllLabel", { branches: collapsedBranches, hidden: hiddenCount })
      }
      className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      onClick={() => {
        if (!isInert) onExpandAll();
      }}
      type="button"
      variant="outline"
    >
      <UnfoldVertical aria-hidden className="size-4" />
      {isInert ? t("expandAll") : t("expandAllCount", { count: collapsedBranches })}
    </Button>
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
  const disabled = params.characterId === null;
  const groups = (
    <>
      {(["treeUp", "treeDown"] as const).map((key) => (
        <div className="flex items-center justify-between gap-2" key={key}>
          <span aria-hidden className="text-sm text-muted-foreground">
            {t(key === "treeUp" ? "ancestors" : "descendants")}
          </span>
          <Segmented
            disabled={disabled}
            label={t(key === "treeUp" ? "ancestorsLabel" : "descendantsLabel")}
            onValueChange={(value) =>
              actions.setGenerations({
                treeDown: key === "treeDown" ? Number(value) : params.treeDown,
                treeUp: key === "treeUp" ? Number(value) : params.treeUp,
              })
            }
            options={TOOLBAR.generationOptions.map((count) => ({
              label: String(count),
              value: String(count),
            }))}
            value={String(params[key])}
          />
        </div>
      ))}
    </>
  );

  return (
    <>
      <div
        aria-label={t("label")}
        className="hidden items-center gap-3 rounded-full border border-border bg-card px-3 py-1 @7xl/workspace:flex"
        role="group"
      >
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <UsersRound aria-hidden className="size-4 text-icon" />
          {t("label")}
        </span>
        {groups}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            className="@7xl/workspace:hidden"
            disabled={disabled}
            type="button"
            variant="outline"
          >
            <UsersRound aria-hidden className="size-4" />
            {t("trigger", { down: params.treeDown, up: params.treeUp })}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" aria-label={t("label")} className="flex w-72 flex-col gap-3">
          {groups}
        </PopoverContent>
      </Popover>
    </>
  );
}

function HelpControl({
  isGenealogy,
  view,
}: {
  isGenealogy: boolean;
  view: GraphWorkspaceParams["view"];
}) {
  const t = useTranslations("relationships.workspace.help");
  const tTree = useTranslations("relationships.workspace.tree.help");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button aria-label={t("trigger")} size="icon" type="button" variant="ghost">
          <UiIcon name="help-circle" size={18} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 flex-col gap-2 text-sm">
        <p className="font-medium">{t("title")}</p>
        {isGenealogy ? (
          <>
            <p className="text-muted-foreground">{tTree("genealogy")}</p>
            <p className="text-muted-foreground">{tTree("navigation")}</p>
            <p className="text-muted-foreground">{tTree("collapse")}</p>
            <p className="text-muted-foreground">{t("spoilers")}</p>
          </>
        ) : null}
        {view === "tree" && !isGenealogy ? (
          <>
            <p className="text-muted-foreground">{tTree("generations")}</p>
            <p className="text-muted-foreground">{tTree("links")}</p>
            <p className="text-muted-foreground">{tTree("lines")}</p>
            <p className="text-muted-foreground">{tTree("navigation")}</p>
            <p className="text-muted-foreground">{t("spoilers")}</p>
          </>
        ) : null}
        {view === "tree" ? null : (
          <>
            <p className="text-muted-foreground">{t("depth")}</p>
            <p className="text-muted-foreground">{t("filters")}</p>
            <p className="text-muted-foreground">{t("click")}</p>
            <p className="text-muted-foreground">{t("spoilers")}</p>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function MoreActions({
  genealogy,
  onOpenPath,
}: {
  genealogy: Nullable<GraphToolbarGenealogy>;
  onOpenPath: () => void;
}) {
  const t = useTranslations("relationships.workspace");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={t("toolbar.more")} size="icon" type="button" variant="outline">
          <UiIcon name="more" size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {genealogy === null ? null : (
          <DropdownMenuItem
            disabled={genealogy.collapsedBranches === 0}
            onSelect={genealogy.onExpandAll}
          >
            <UnfoldVertical aria-hidden />
            <span className="flex min-w-0 flex-col">
              <span>
                {genealogy.collapsedBranches === 0
                  ? t("genealogy.bar.expandAll")
                  : t("genealogy.bar.expandAllCount", { count: genealogy.collapsedBranches })}
              </span>
              {genealogy.collapsedBranches === 0 ? null : (
                <span className="text-xs text-muted-foreground">
                  {t("genealogy.bar.hiddenCharacters", { count: genealogy.hiddenCount })}
                </span>
              )}
            </span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onOpenPath}>
          <Route aria-hidden />
          {t("pathEntry")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TreeOptionsControl({
  compact,
  onChange,
  onReset,
  options,
}: {
  compact: boolean;
  onChange: (options: TreeOptions) => void;
  onReset: () => void;
  options: TreeOptions;
}) {
  const t = useTranslations("relationships.workspace.treeOptions");
  const enabled = countEnabledTreeOptions(options);
  const total = TREE_OPTION_KEYS.length;
  const changedKeys = TREE_OPTION_KEYS.filter(
    (key) => options[key] !== TREE_SCENE.defaultOptions[key],
  );
  const isDefault = changedKeys.length === 0;
  const toggle = (key: TreeOptionKey, checked: boolean) => onChange({ ...options, [key]: checked });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label={
            isDefault
              ? t("triggerLabel", { enabled, total })
              : t("triggerLabelChanged", { changed: changedKeys.length, enabled, total })
          }
          type="button"
          variant="outline"
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          <span className={cn(compact && "sr-only")}>{t("trigger")}</span>
          <span
            className={cn(
              "rounded-full px-1.5 text-xs font-semibold tabular-nums",
              isDefault ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary",
            )}
          >
            {t("count", { enabled, total })}
          </span>
          {isDefault ? null : <span aria-hidden className="size-1.5 rounded-full bg-primary" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" aria-label={t("trigger")} className="flex w-80 flex-col gap-3">
        <div className="flex items-start gap-2 rounded-xl bg-muted/60 px-2.5 py-2">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-medium">{t("lineageTitle")}</span>
            <span className="text-xs text-muted-foreground">{t("lineage")}</span>
          </div>
        </div>
        <ul className="flex flex-col gap-2.5">
          {TREE_OPTION_KEYS.map((key) => {
            const isChanged = options[key] !== TREE_SCENE.defaultOptions[key];
            return (
              <li className="flex items-start gap-2" key={key}>
                <Checkbox
                  aria-describedby={`tree-option-${key}-hint`}
                  checked={options[key]}
                  className="mt-0.5"
                  id={`tree-option-${key}`}
                  onCheckedChange={(checked) => toggle(key, checked === true)}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <Label htmlFor={`tree-option-${key}`}>{t(key)}</Label>
                    {isChanged ? (
                      <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary">
                        {t(TREE_SCENE.defaultOptions[key] ? "changedOff" : "changedOn")}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground" id={`tree-option-${key}-hint`}>
                    {t(`hints.${key}`)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-2.5 py-2 text-xs text-foreground">
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0 text-warning" />
          {t("hidesCharacters")}
        </p>
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
          <p className="text-xs text-muted-foreground">{t("partners")}</p>
          <Button
            aria-disabled={isDefault}
            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            onClick={() => {
              if (!isDefault) onReset();
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            <RotateCcw aria-hidden />
            {t("reset")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
