"use client";

import type {
  CharacterGraphEdgeView,
  CharacterGraphNodeView,
  CharacterRelationshipPathView,
} from "@app/shared";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import type { RelationshipActions } from "../../model/relationship-adapter";
import type { RelationshipParticipant } from "../../model/relationship-form-schema";
import type { GraphWorkspaceParams } from "../../model/workspace/graph-workspace-params";
import type { GraphReaderKey } from "../../model/workspace/graph-workspace-request";
import type { GraphWorkspaceState } from "../../model/workspace/use-graph-workspace-state";
import type { WorkspaceWidthClass } from "./use-workspace-width-class";

import { relationshipKeys } from "../../api/relationship-keys";
import {
  type GraphWorkspaceEndpoint,
  useGraphWorkspaceEndpoint,
  useGraphWorkspacePath,
} from "../../api/use-graph-workspace-queries";
import { toGraphWorkspacePathRequest } from "../../model/workspace/graph-workspace-request";
import { RelationshipParticipantPicker } from "../relationship-participant-picker";
import { GraphCharacterDetails } from "./graph-character-details";
import { GraphConnectionDetails } from "./graph-connection-details";
import { GraphDetailsPanel } from "./graph-details-panel";
import { useGraphEdgeLabel } from "./use-graph-edge-label";

type GraphPathExplorerProps = {
  actions: GraphWorkspaceState["actions"];
  bookId: string;
  params: GraphWorkspaceParams;
  reader: GraphReaderKey;
  relationshipActions: RelationshipActions;
  widthClass: WorkspaceWidthClass;
};

type PathSelection =
  | null
  | { edge: CharacterGraphEdgeView; kind: "step" }
  | { kind: "character"; node: CharacterGraphNodeView };

type PathStatus =
  | { kind: "error" }
  | { kind: "found"; path: CharacterRelationshipPathView }
  | { kind: "idle" }
  | { kind: "limited" }
  | { kind: "loading" }
  | { kind: "notFound" }
  | { kind: "same" }
  | { kind: "unavailable" }
  | { kind: "unknown" };

const ENDPOINT_FIELDS = [
  { id: "graph-path-from", key: "from" },
  { id: "graph-path-to", key: "to" },
] as const;

export function GraphPathExplorer({
  actions,
  bookId,
  params,
  reader,
  relationshipActions,
  widthClass,
}: GraphPathExplorerProps) {
  const t = useTranslations("relationships.workspace.path");
  const queryClient = useQueryClient();
  const toLabel = useGraphEdgeLabel();
  const toDirection = usePathDirectionText();
  const [selection, setSelection] = useState<PathSelection>(null);
  const lastTrigger = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);
  const hasSelection = selection !== null;
  const fromEndpoint = useGraphWorkspaceEndpoint({ bookId, characterId: params.from, reader });
  const toEndpoint = useGraphWorkspaceEndpoint({ bookId, characterId: params.to, reader });
  const endpoints = { from: fromEndpoint, to: toEndpoint };
  const bothValid = fromEndpoint.data?.kind === "valid" && toEndpoint.data?.kind === "valid";
  const request = bothValid ? toGraphWorkspacePathRequest(params) : null;
  const path = useGraphWorkspacePath({ bookId, reader, request });
  const status = toPathStatus({ endpoints, params, path });
  const hasFilters = params.categories.length > 0 || params.types.length > 0;

  useEffect(() => {
    if (!hasSelection) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"][data-state="open"]') !== null) return;
      setSelection(null);
      restoreTriggerFocus(lastTrigger.current);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hasSelection]);

  function open(next: Exclude<PathSelection, null>) {
    if (selection === null && document.activeElement instanceof HTMLElement) {
      lastTrigger.current = document.activeElement;
    }
    setSelection(next);
  }

  function pickEndpoint(key: "from" | "to", participant: RelationshipParticipant) {
    const endpoint: GraphWorkspaceEndpoint = { kind: "valid", participant };
    queryClient.setQueryData(
      relationshipKeys.workspace({
        bookId,
        reader,
        request: { characterId: participant.id, kind: "endpoint" },
      }),
      endpoint,
    );
    setSelection(null);
    actions.setPathEndpoints({
      from: key === "from" ? participant.id : params.from,
      to: key === "to" ? participant.id : params.to,
    });
  }

  const nodeNames = new Map(
    status.kind === "found" ? status.path.nodes.map((node) => [node.id, node.displayName]) : [],
  );

  return (
    <section aria-labelledby="graph-path-title" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          className="font-heading text-xl font-medium outline-none"
          id="graph-path-title"
          ref={heading}
          tabIndex={-1}
        >
          {t("title")}
        </h2>
        <Button onClick={actions.closePath} type="button" variant="outline">
          <UiIcon name="arrow-left" size={16} />
          {t("back")}
        </Button>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {ENDPOINT_FIELDS.map((field) => {
          const endpoint = endpoints[field.key].data;
          const otherId = field.key === "from" ? params.to : params.from;
          return (
            <div className="flex min-w-0 flex-1 flex-col gap-1.5" key={field.key}>
              <Label htmlFor={field.id}>{t(field.key)}</Label>
              <RelationshipParticipantPicker
                bookId={bookId}
                excludedIds={otherId === null ? [] : [otherId]}
                id={field.id}
                invalid={endpoint?.kind === "unavailable"}
                onBlur={() => undefined}
                onChange={(participant) => pickEndpoint(field.key, participant)}
                value={endpoint?.kind === "valid" ? endpoint.participant : null}
              />
            </div>
          );
        })}
        <Button
          aria-label={t("swap")}
          disabled={params.from === null && params.to === null}
          onClick={() => actions.setPathEndpoints({ from: params.to, to: params.from })}
          size="icon"
          type="button"
          variant="outline"
        >
          <UiIcon name="swap" size={16} />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("context")} {hasFilters ? t("filtered") : null}
      </p>
      <div className="flex gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div aria-live="polite" className="flex flex-col gap-3">
            <PathStatusMessage
              onClear={() => actions.setPathEndpoints({ from: null, to: null })}
              onRetry={() => {
                const failed = [fromEndpoint, toEndpoint].filter((endpoint) => endpoint.isError);
                if (failed.length === 0) {
                  void path.refetch();
                  return;
                }
                for (const endpoint of failed) void endpoint.refetch();
              }}
              status={status}
            />
            {status.kind === "found" ? (
              <p className="text-sm font-medium">
                {t("found", { count: status.path.edges.length })}
              </p>
            ) : null}
          </div>
          {status.kind === "found" ? (
            <>
              <p className="text-xs text-muted-foreground">{t("stepHint")}</p>
              <ol aria-label={t("sequence")} className="flex flex-col gap-2">
                {status.path.nodes.map((node, index) => {
                  const edge = status.path.edges[index];
                  return (
                    <li className="flex flex-col gap-2" key={node.id}>
                      <PathNodeButton
                        node={node}
                        onOpen={() => open({ kind: "character", node })}
                      />
                      {edge === undefined ? null : (
                        <Button
                          className="ml-6 h-auto max-w-full flex-wrap justify-start gap-2 self-start py-1.5 text-left whitespace-normal"
                          onClick={() => open({ edge, kind: "step" })}
                          type="button"
                          variant="ghost"
                        >
                          <span className="text-xs font-medium text-muted-foreground">
                            {t("step", { index: index + 1 })}
                          </span>
                          <span className="text-sm">{toLabel(edge)}</span>
                          <span className="text-xs text-muted-foreground">
                            {toDirection({ edge, nodeNames })}
                          </span>
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ol>
            </>
          ) : null}
        </div>
        <GraphDetailsPanel
          onClose={() => setSelection(null)}
          onRestoreFocus={() => restoreTriggerFocus(lastTrigger.current)}
          open={selection !== null}
          title={selection?.kind === "character" ? selection.node.displayName : t("stepTitle")}
          widthClass={widthClass === "compact" ? "compact" : "wide"}
        >
          {selection?.kind === "character" ? (
            <GraphCharacterDetails
              bookId={bookId}
              branch={null}
              connections={[]}
              isRoot={false}
              node={selection.node}
              onExplore={() => actions.exploreFromPath(selection.node.id)}
              onFindPath={null}
              onMakeCenter={null}
              onOpenConnection={() => undefined}
            />
          ) : null}
          {selection?.kind === "step" ? (
            <GraphConnectionDetails
              actions={relationshipActions}
              contentKey={JSON.stringify([bookId, reader])}
              edges={[selection.edge]}
              names={{
                source: nodeNames.get(selection.edge.source) ?? "",
                target: nodeNames.get(selection.edge.target) ?? "",
              }}
              scope={{ bookId, kind: "book" }}
            />
          ) : null}
        </GraphDetailsPanel>
      </div>
    </section>
  );
}

function PathNodeButton({ node, onOpen }: { node: CharacterGraphNodeView; onOpen: () => void }) {
  return (
    <Button
      className="h-auto w-full max-w-sm justify-start gap-3 rounded-xl px-3 py-2"
      onClick={onOpen}
      type="button"
      variant="outline"
    >
      <Avatar size="lg">
        {node.displayMedia === null ? null : (
          <AvatarImage alt="" src={node.displayMedia.urls.thumb} />
        )}
        <AvatarFallback>{node.displayName.trim().charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 truncate font-medium">{node.displayName}</span>
    </Button>
  );
}

function PathStatusMessage({
  onClear,
  onRetry,
  status,
}: {
  onClear: () => void;
  onRetry: () => void;
  status: PathStatus;
}) {
  const t = useTranslations("relationships.workspace.path");
  switch (status.kind) {
    case "error":
      return (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-destructive">{t("error")}</p>
          <Button onClick={onRetry} size="sm" type="button" variant="outline">
            {t("retry")}
          </Button>
        </div>
      );
    case "found":
      return null;
    case "unavailable":
      return (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">{t("unavailable")}</p>
          <Button onClick={onClear} size="sm" type="button" variant="outline">
            {t("clear")}
          </Button>
        </div>
      );
    default:
      return <p className="text-sm text-muted-foreground">{t(status.kind)}</p>;
  }
}

function restoreTriggerFocus(trigger: HTMLElement | null): void {
  requestAnimationFrame(() => {
    if (trigger !== null && trigger.isConnected) trigger.focus();
  });
}

function toPathStatus({
  endpoints,
  params,
  path,
}: {
  endpoints: Record<"from" | "to", { data: GraphWorkspaceEndpoint | undefined; isError: boolean }>;
  params: GraphWorkspaceParams;
  path: { data: CharacterRelationshipPathView | undefined; isError: boolean };
}): PathStatus {
  if (params.from === null || params.to === null) return { kind: "idle" };
  if (params.from === params.to) return { kind: "same" };
  if (endpoints.from.isError || endpoints.to.isError) return { kind: "error" };
  const endpointKinds = [endpoints.from.data?.kind, endpoints.to.data?.kind];
  if (endpointKinds.includes("unavailable")) return { kind: "unavailable" };
  if (endpointKinds.includes(undefined)) return { kind: "loading" };
  if (path.isError) return { kind: "error" };
  if (path.data === undefined) return { kind: "loading" };
  if (path.data.found) return { kind: "found", path: path.data };
  if (path.data.searchLimited === true) return { kind: "limited" };
  return path.data.searchLimited === false ? { kind: "notFound" } : { kind: "unknown" };
}

function usePathDirectionText(): (args: {
  edge: CharacterGraphEdgeView;
  nodeNames: ReadonlyMap<string, string>;
}) => string {
  const t = useTranslations("relationships.workspace.path.direction");
  return ({ edge, nodeNames }) => {
    if (edge.typeHidden || edge.directionality === null) return t("unknown");
    if (edge.directionality === "symmetric") return t("symmetric");
    return t("forward", {
      source: nodeNames.get(edge.source) ?? "",
      target: nodeNames.get(edge.target) ?? "",
    });
  };
}
