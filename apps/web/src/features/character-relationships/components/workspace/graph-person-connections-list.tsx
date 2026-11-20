"use client";

import type { CharacterGraphNodeView, Nullable } from "@app/shared";

import { ChevronRight, Search, Waypoints, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { TitleLeaf } from "@/components/title-leaf";
import { TruncatedText } from "@/components/truncated-text";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

import type {
  GraphPairEntry,
  GraphPairSemantics,
} from "../../model/workspace/graph-person-semantics";
import type { GraphPresentationCharacter } from "../../model/workspace/graph-workspace-presentation";
import type { WorkspaceWidthClass } from "./use-workspace-width-class";

import { filterGraphPairEntries } from "../../model/workspace/graph-person-semantics";
import { GraphPersonRelationChip } from "./graph-person-relation-chip";
import { useGraphPairLabel } from "./use-graph-pair-label";

const PERSON_LIST = {
  pageSize: 8,
} as const;

type GraphPersonConnectionsListProps = {
  characters: ReadonlyMap<string, GraphPresentationCharacter>;
  entries: readonly GraphPairEntry[];
  id: string;
  onConnectionOpen: (connectionId: string) => void;
  relationships: number;
  selectedId: Nullable<string>;
  semantics: ReadonlyMap<string, GraphPairSemantics>;
  widthClass: WorkspaceWidthClass;
};

export function GraphPersonConnectionsList({
  characters,
  entries,
  id,
  onConnectionOpen,
  relationships,
  selectedId,
  semantics,
  widthClass,
}: GraphPersonConnectionsListProps) {
  const t = useTranslations("relationships.workspace.personList");
  const toLabel = useGraphPairLabel();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  if (entries.length === 0) return null;

  const nameOf = (characterId: string) => characters.get(characterId)?.node.displayName ?? "";
  const matches = filterGraphPairEntries({ entries, nameOf, query });
  const shown = expanded ? matches : matches.slice(0, PERSON_LIST.pageSize);
  const titleId = `${id}-title`;

  return (
    <section
      aria-labelledby={titleId}
      className="flex scroll-mt-20 flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft sm:p-4"
      id={id}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h2
              className="flex items-center gap-2 font-heading text-lg font-semibold text-ink"
              id={titleId}
            >
              <Waypoints aria-hidden className="size-5 text-icon" />
              {t("title")}
            </h2>
            {widthClass === "compact" ? null : <TitleLeaf />}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("counts", { pairs: entries.length, relationships })}
          </p>
        </div>
        <InputGroup className="h-9 w-full rounded-full sm:w-72">
          <InputGroupAddon>
            <Search aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={t("search")}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search")}
            type="search"
            value={query}
          />
          {query === "" ? null : (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label={t("clearSearch")}
                onClick={() => setQuery("")}
                size="icon-xs"
              >
                <X aria-hidden />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
      </div>
      {matches.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground" role="status">
          {t("noMatches")}
        </p>
      ) : (
        <ul className={cn("grid gap-2", widthClass !== "compact" && "grid-cols-2")}>
          {shown.map((entry) => {
            const first = characters.get(entry.firstId)?.node;
            const second = characters.get(entry.secondId)?.node;
            const pair = semantics.get(entry.connection.id);
            if (first === undefined || second === undefined || pair === undefined) return null;
            const names = t("pair", { first: first.displayName, second: second.displayName });
            return (
              <li className="min-w-0" key={entry.connection.id}>
                <button
                  aria-current={selectedId === entry.connection.id ? "true" : undefined}
                  aria-label={t("open", { label: toLabel(pair), names })}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-background/60 px-3 py-2.5 text-left transition-colors outline-none hover:border-accent-border hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=true]:border-primary aria-[current=true]:bg-accent/30 aria-[current=true]:ring-2 aria-[current=true]:ring-primary motion-reduce:transition-none"
                  onClick={() => onConnectionOpen(entry.connection.id)}
                  type="button"
                >
                  <span aria-hidden className="flex shrink-0 -space-x-2.5">
                    <PairAvatar node={first} />
                    <PairAvatar node={second} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <TruncatedText className="text-sm font-medium" text={names} />
                    <GraphPersonRelationChip className="self-start" semantics={pair} />
                  </span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {matches.length > PERSON_LIST.pageSize ? (
        <Button
          aria-expanded={expanded}
          className="self-center"
          onClick={() => setExpanded((current) => !current)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {expanded ? t("showLess") : t("showAll", { count: matches.length })}
        </Button>
      ) : null}
    </section>
  );
}

function PairAvatar({ node }: { node: CharacterGraphNodeView }) {
  return (
    <Avatar className="size-9 border-2 border-card">
      {node.displayMedia === null ? null : (
        <AvatarImage alt="" className="object-cover" src={node.displayMedia.urls.thumb} />
      )}
      <AvatarFallback>{node.displayName.trim().charAt(0).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}
