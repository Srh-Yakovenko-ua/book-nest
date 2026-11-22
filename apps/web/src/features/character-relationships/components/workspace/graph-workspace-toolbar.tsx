"use client";

import type { Nullable } from "@app/shared";

import {
  CHARACTER_GRAPH_DEPTH_MAX,
  CHARACTER_GRAPH_DEPTH_MIN,
  FAMILY_TREE_GENERATIONS,
} from "@app/shared";
import { Lock, RotateCcw, Route, SlidersHorizontal, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

import type { RelationshipParticipant } from "../../model/relationship-form-schema";
import type { TreeOptionKey, TreeOptions } from "../../model/workspace/graph-tree-scene";
import type {
  GraphWorkspaceParams,
  NetworkGrouping,
} from "../../model/workspace/graph-workspace-params";
import type { GraphWorkspaceState } from "../../model/workspace/use-graph-workspace-state";

import {
  countEnabledTreeOptions,
  TREE_OPTION_KEYS,
  TREE_SCENE,
} from "../../model/workspace/graph-tree-scene";
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
  filtersTriggerId: string;
  onTreeOptionsChange: (options: TreeOptions) => void;
  onTreeOptionsReset: () => void;
  params: GraphWorkspaceParams;
  rootParticipant: Nullable<RelationshipParticipant>;
  treeOptions: TreeOptions;
};

export function GraphWorkspaceToolbar({
  actions,
  bookId,
  filtersTriggerId,
  onTreeOptionsChange,
  onTreeOptionsReset,
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
      {params.view === "tree" ? (
        <>
          <GenerationsControl actions={actions} params={params} />
          <TreeOptionsControl
            onChange={onTreeOptionsChange}
            onReset={onTreeOptionsReset}
            options={treeOptions}
          />
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
      {params.view === "tree" ? null : (
        <GraphWorkspaceFilters
          categories={params.categories}
          onChange={actions.setFilters}
          onReset={actions.resetFilters}
          triggerId={filtersTriggerId}
          types={params.types}
        />
      )}
      <Button
        onClick={() => actions.openPath(params.view === "network" ? null : params.characterId)}
        type="button"
        variant="secondary"
      >
        <Route aria-hidden className="size-4" />
        {t(params.view === "person" ? "pathEntryShort" : "pathEntry")}
      </Button>
      <HelpControl view={params.view} />
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
        className="hidden items-center gap-3 rounded-full border border-border bg-card px-3 py-1 @3xl/workspace:flex"
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
            className="@3xl/workspace:hidden"
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

function HelpControl({ view }: { view: GraphWorkspaceParams["view"] }) {
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
        {view === "tree" ? (
          <>
            <p className="text-muted-foreground">{tTree("generations")}</p>
            <p className="text-muted-foreground">{tTree("links")}</p>
            <p className="text-muted-foreground">{tTree("lines")}</p>
            <p className="text-muted-foreground">{t("spoilers")}</p>
          </>
        ) : (
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

function TreeOptionsControl({
  onChange,
  onReset,
  options,
}: {
  onChange: (options: TreeOptions) => void;
  onReset: () => void;
  options: TreeOptions;
}) {
  const t = useTranslations("relationships.workspace.treeOptions");
  const enabled = countEnabledTreeOptions(options);
  const total = TREE_OPTION_KEYS.length;
  const isDefault = TREE_OPTION_KEYS.every(
    (key) => options[key] === TREE_SCENE.defaultOptions[key],
  );
  const toggle = (key: TreeOptionKey, checked: boolean) => onChange({ ...options, [key]: checked });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button aria-label={t("triggerLabel", { enabled, total })} type="button" variant="outline">
          <SlidersHorizontal aria-hidden className="size-4" />
          {t("trigger")}
          <span className="rounded-full bg-muted px-1.5 text-xs font-semibold text-muted-foreground tabular-nums">
            {t("count", { enabled, total })}
          </span>
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
          {TREE_OPTION_KEYS.map((key) => (
            <li className="flex items-start gap-2" key={key}>
              <Checkbox
                aria-describedby={`tree-option-${key}-hint`}
                checked={options[key]}
                className="mt-0.5"
                id={`tree-option-${key}`}
                onCheckedChange={(checked) => toggle(key, checked === true)}
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <Label htmlFor={`tree-option-${key}`}>{t(key)}</Label>
                <span className="text-xs text-muted-foreground" id={`tree-option-${key}-hint`}>
                  {t(`hints.${key}`)}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
          <p className="text-xs text-muted-foreground">{t("partners")}</p>
          <Button disabled={isDefault} onClick={onReset} size="sm" type="button" variant="ghost">
            <RotateCcw aria-hidden />
            {t("reset")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
