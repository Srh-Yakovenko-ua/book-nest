"use client";

import type { Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

import { normalizeGenealogyQuery } from "../../model/workspace/graph-genealogy-navigation";

export const NETWORK_PANEL_LIST = {
  batch: 40,
  preview: 5,
} as const;

type GraphNetworkPanelListProps<Item> = {
  emptyText: string;
  items: readonly Item[];
  keyOf: (item: Item) => string;
  namesOf: (item: Item) => readonly string[];
  renderItem: (item: Item) => ReactNode;
  title: string;
};

type PanelListMode = { kind: "all"; limit: number; query: string } | { kind: "preview" };

export function filterByNetworkName<Item>({
  items,
  namesOf,
  query,
}: {
  items: readonly Item[];
  namesOf: (item: Item) => readonly string[];
  query: string;
}): readonly Item[] {
  const needle = normalizeGenealogyQuery(query);
  if (needle.length === 0) return items;
  return items.filter((item) =>
    namesOf(item).some((name) => normalizeGenealogyQuery(name).includes(needle)),
  );
}

export function GraphNetworkPanelList<Item>({
  emptyText,
  items,
  keyOf,
  namesOf,
  renderItem,
  title,
}: GraphNetworkPanelListProps<Item>) {
  const t = useTranslations("relationships.workspace.networkPanel.list");
  const titleId = useId();
  const itemsId = useId();
  const [mode, setMode] = useState<PanelListMode>({ kind: "preview" });
  const itemsRef = useRef<Nullable<HTMLUListElement>>(null);
  const pendingFocus = useRef<Nullable<number>>(null);

  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    pendingFocus.current = null;
    itemsRef.current?.children[target]?.querySelector<HTMLElement>("button, a")?.focus();
  }, [mode]);

  const firstBatch = { kind: "all", limit: NETWORK_PANEL_LIST.batch, query: "" } as const;
  const canExpand = items.length > NETWORK_PANEL_LIST.preview;
  const matches =
    mode.kind === "all" ? filterByNetworkName({ items, namesOf, query: mode.query }) : items;
  const visible = matches.slice(0, mode.kind === "all" ? mode.limit : NETWORK_PANEL_LIST.preview);
  const nextBatch =
    mode.kind === "all" ? Math.min(NETWORK_PANEL_LIST.batch, matches.length - visible.length) : 0;

  function showMore() {
    if (mode.kind === "preview") return;
    pendingFocus.current = visible.length;
    setMode({ ...mode, limit: mode.limit + NETWORK_PANEL_LIST.batch });
  }

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 font-heading text-base font-semibold text-ink" id={titleId}>
          {title}
        </h3>
        {canExpand ? (
          <Button
            aria-controls={itemsId}
            aria-expanded={mode.kind === "all"}
            className="shrink-0"
            onClick={() => setMode(mode.kind === "all" ? { kind: "preview" } : firstBatch)}
            size="sm"
            type="button"
            variant="link"
          >
            {mode.kind === "all" ? t("showLess") : t("showAll", { count: items.length })}
          </Button>
        ) : null}
      </div>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">{emptyText}</p> : null}
      {mode.kind === "all" && items.length > 0 ? (
        <InputGroup className="h-9 w-full rounded-full">
          <InputGroupAddon>
            <Search aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            aria-controls={itemsId}
            aria-label={t("filter")}
            onChange={(event) => setMode({ ...firstBatch, query: event.target.value })}
            onKeyDown={(event) => {
              if (event.key !== "Escape" || mode.query === "") return;
              event.preventDefault();
              setMode(firstBatch);
            }}
            placeholder={t("filter")}
            type="search"
            value={mode.query}
          />
          {mode.query === "" ? null : (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label={t("clearFilter")}
                onClick={() => setMode(firstBatch)}
                size="icon-xs"
              >
                <X aria-hidden />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
      ) : null}
      {mode.kind === "all" ? (
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {matches.length === 0
            ? t("noMatches")
            : t("shown", { shown: visible.length, total: matches.length })}
        </p>
      ) : null}
      {items.length === 0 ? null : (
        <ul className="flex flex-col gap-1.5" id={itemsId} ref={itemsRef}>
          {visible.map((item) => (
            <li className="min-w-0" key={keyOf(item)}>
              {renderItem(item)}
            </li>
          ))}
        </ul>
      )}
      {nextBatch > 0 ? (
        <Button
          aria-controls={itemsId}
          className="self-center"
          onClick={showMore}
          size="sm"
          type="button"
          variant="outline"
        >
          {t("showMore", { count: nextBatch })}
        </Button>
      ) : null}
    </section>
  );
}
