"use client";

import type { CharacterFactView, Nullable } from "@app/shared";

import { CHARACTER_FACT_INPUT_LIMITS } from "@app/shared";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import type { CharacterFactsScope } from "../api/character-keys";
import type { CharacterFactFormTarget } from "../model/character-fact-form-schema";

import { useCharacterFactsInfinite } from "../api/use-character-facts-infinite";
import { useReleaseOrphanedDraftSentinel } from "../hooks/use-character-fact-draft-guard";
import { toCharacterFactsSearch } from "../model/character-details-query";
import { useCharacterFactsSearch } from "../model/use-character-details-query";
import { CharacterFactFormDialog } from "./character-fact-form-dialog";
import { CharacterFactsContent } from "./character-facts-content";
import { DeleteCharacterFactDialog } from "./delete-character-fact-dialog";

type FactsOverlay =
  | {
      fact: CharacterFactView;
      isDeleted: boolean;
      kind: "delete";
      neighborIds: string[];
      open: boolean;
    }
  | { kind: "form"; open: boolean; session: number; target: CharacterFactFormTarget };

export function CharacterFactsList({ bookId, characterId }: CharacterFactsScope) {
  const t = useTranslations("characters.facts");
  const [q, setQ] = useCharacterFactsSearch();
  const facts = useCharacterFactsInfinite({ bookId, characterId, q });
  const [overlay, setOverlay] = useState<Nullable<FactsOverlay>>(null);
  const returnFocusRef = useRef<Nullable<HTMLElement>>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scope = { bookId, characterId };
  useReleaseOrphanedDraftSentinel();

  const items = (facts.data?.pages ?? []).flatMap((page) => page.items);
  const hasSearch = toCharacterFactsSearch(q) !== "";
  const isEmptyBook = facts.data !== undefined && items.length === 0 && !hasSearch;

  function clearSearch() {
    void setQ(null);
    searchInputRef.current?.focus();
  }

  function openForm(target: CharacterFactFormTarget, trigger: Nullable<HTMLElement>) {
    returnFocusRef.current = trigger;
    setOverlay((current) => ({
      kind: "form",
      open: true,
      session: (current?.kind === "form" ? current.session : 0) + 1,
      target,
    }));
  }

  function openDelete(fact: CharacterFactView, trigger: Nullable<HTMLElement>) {
    returnFocusRef.current = trigger;
    const index = items.findIndex((item) => item.id === fact.id);
    const neighborIds = [items[index + 1], items[index - 1]].flatMap((neighbor) =>
      neighbor === undefined ? [] : [neighbor.id],
    );
    setOverlay({ fact, isDeleted: false, kind: "delete", neighborIds, open: true });
  }

  function finishDelete() {
    setOverlay((current) =>
      current?.kind === "delete" ? { ...current, isDeleted: true, open: false } : current,
    );
  }

  function focusAfterDelete(event: Event, neighborIds: string[]) {
    const target = findFactMenuTrigger(sectionRef.current, neighborIds) ?? addButtonRef.current;
    if (target === null || !target.isConnected) return;
    event.preventDefault();
    target.focus();
  }

  function returnFocus(event: Event) {
    const trigger = returnFocusRef.current;
    if (trigger === null || !trigger.isConnected) return;
    event.preventDefault();
    trigger.focus();
  }

  function closeOverlay() {
    setOverlay((current) => (current === null ? null : { ...current, open: false }));
  }

  return (
    <section className="flex flex-col gap-4" ref={sectionRef}>
      <h2 className="sr-only">{t("tabs.facts")}</h2>
      {isEmptyBook ? null : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <DebouncedSearchInput
              clearLabel={t("search.clear")}
              inputRef={searchInputRef}
              label={t("search.label")}
              maxLength={CHARACTER_FACT_INPUT_LIMITS.searchMax}
              onClear={clearSearch}
              onSearch={(value) => void setQ(value)}
              placeholder={t("search.placeholder")}
              value={q}
            />
          </div>
          <Button
            className="h-10"
            onClick={(event) => openForm({ mode: "create" }, event.currentTarget)}
            ref={addButtonRef}
          >
            <UiIcon name="plus" size={16} />
            {t("add")}
          </Button>
        </div>
      )}
      <CharacterFactsContent
        addButtonRef={addButtonRef}
        facts={facts}
        hasSearch={hasSearch}
        items={items}
        onAdd={() => openForm({ mode: "create" }, null)}
        onClearSearch={clearSearch}
        onDelete={openDelete}
        onEdit={(fact, trigger) => openForm({ fact, mode: "edit" }, trigger)}
        totalCount={facts.data?.pages[0]?.totalCount ?? items.length}
      />

      {overlay?.kind === "form" ? (
        <CharacterFactFormDialog
          fallbackFocusRef={addButtonRef}
          key={overlay.session}
          onClose={closeOverlay}
          open={overlay.open}
          returnFocusRef={returnFocusRef}
          scope={scope}
          target={overlay.target}
        />
      ) : null}

      {overlay?.kind === "delete" ? (
        <DeleteCharacterFactDialog
          fact={overlay.fact}
          onClose={closeOverlay}
          onCloseAutoFocus={(event) =>
            overlay.isDeleted ? focusAfterDelete(event, overlay.neighborIds) : returnFocus(event)
          }
          onDeleted={finishDelete}
          open={overlay.open}
          scope={scope}
        />
      ) : null}
    </section>
  );
}

function findFactMenuTrigger(
  section: Nullable<HTMLElement>,
  factIds: string[],
): Nullable<HTMLElement> {
  for (const factId of factIds) {
    const trigger = section?.querySelector<HTMLElement>(
      `[data-fact-menu-trigger="${CSS.escape(factId)}"]`,
    );
    if (trigger !== undefined && trigger !== null) return trigger;
  }
  return null;
}
