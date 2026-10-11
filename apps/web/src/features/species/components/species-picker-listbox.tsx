"use client";

import type { Nullable, SpeciesOptionView } from "@app/shared";
import type { ReactNode } from "react";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import type { SpeciesGroupHeading } from "../model/species-groups";
import type {
  SpeciesCreateOffer,
  SpeciesPickerNotice,
  SpeciesPickerSection,
} from "../model/use-species-picker-model";

import { useSpeciesPickerNoticeText } from "../model/use-species-picker-notice-text";

type PickerOptionProps = {
  active: boolean;
  children: ReactNode;
  id: string;
  onHighlight: () => void;
  onPick: () => void;
  selected: boolean;
};

type SpeciesPickerListboxProps = {
  activeId: string | undefined;
  create: Nullable<SpeciesCreateOffer>;
  createId: string;
  isCreating: boolean;
  label: string;
  listboxId: string;
  notice: Nullable<SpeciesPickerNotice>;
  onCreate: () => void;
  onHighlight: (entryId: string) => void;
  onPick: (option: SpeciesOptionView) => void;
  onRetry: () => void;
  sections: SpeciesPickerSection[];
  selectedId: Nullable<string>;
};

const NOTICE_TONE = {
  conflict: "text-warning",
  createFailed: "text-error",
  empty: "text-muted-foreground",
  loadFailed: "text-error",
  loading: "text-muted-foreground",
  tooShort: "text-muted-foreground",
} as const satisfies Record<SpeciesPickerNotice, string>;

export function speciesPickerEntryId(listboxId: string, key: string): string {
  return `${listboxId}-${key}`;
}

export function SpeciesPickerListbox({
  activeId,
  create,
  createId,
  isCreating,
  label,
  listboxId,
  notice,
  onCreate,
  onHighlight,
  onPick,
  onRetry,
  sections,
  selectedId,
}: SpeciesPickerListboxProps) {
  const t = useTranslations("species.picker");

  return (
    <>
      {notice === null ? null : <PickerNotice notice={notice} onRetry={onRetry} />}
      <div
        aria-busy={notice === "loading"}
        aria-label={label}
        className="no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto"
        id={listboxId}
        role="listbox"
        tabIndex={-1}
      >
        {sections.map((section) => {
          const key = section.kind === "group" ? section.group.key : section.kind;
          const groupId = speciesPickerEntryId(listboxId, `group-${key}`);
          const options = section.kind === "group" ? section.group.options : section.options;

          return (
            <PickerGroup
              hint={section.kind === "similar" ? t("similarHint") : null}
              id={groupId}
              key={key}
              title={
                section.kind === "group" ? (
                  <GroupHeading heading={section.group.heading} />
                ) : (
                  t(section.kind === "exact" ? "exactHeading" : "similarHeading")
                )
              }
            >
              {options.map((option) => {
                const id = speciesPickerEntryId(listboxId, option.id);
                return (
                  <PickerOption
                    active={id === activeId}
                    id={id}
                    key={option.id}
                    onHighlight={() => onHighlight(id)}
                    onPick={() => onPick(option)}
                    selected={option.id === selectedId}
                  >
                    {section.kind === "exact"
                      ? t("selectExisting", { name: option.name })
                      : option.name}
                  </PickerOption>
                );
              })}
            </PickerGroup>
          );
        })}
        {create === null ? null : (
          <CreateOption
            active={createId === activeId}
            create={create}
            id={createId}
            isCreating={isCreating}
            onCreate={onCreate}
            onHighlight={() => onHighlight(createId)}
          />
        )}
      </div>
    </>
  );
}

function CreateOption({
  active,
  create,
  id,
  isCreating,
  onCreate,
  onHighlight,
}: {
  active: boolean;
  create: SpeciesCreateOffer;
  id: string;
  isCreating: boolean;
  onCreate: () => void;
  onHighlight: () => void;
}) {
  const t = useTranslations("species.picker");
  const idleLabel = create.secondary
    ? t("createAnyway", { name: create.name })
    : t("create", { name: create.name });

  return (
    <button
      aria-disabled={isCreating}
      aria-selected={active}
      className="group relative flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden select-none aria-disabled:cursor-progress aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:ring-1 aria-selected:ring-ring"
      id={id}
      onClick={onCreate}
      onPointerMove={onHighlight}
      role="option"
      tabIndex={-1}
      type="button"
    >
      {isCreating ? (
        <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <UiIcon
          className={create.secondary ? "text-muted-foreground" : "text-primary"}
          name="plus"
          size={16}
        />
      )}
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          create.secondary && "text-muted-foreground group-aria-selected:text-accent-foreground",
        )}
      >
        {isCreating ? t("creating", { name: create.name }) : idleLabel}
      </span>
    </button>
  );
}

function GroupHeading({ heading }: { heading: SpeciesGroupHeading }) {
  const t = useTranslations("species.picker");
  if (heading.kind === "category") return heading.name;
  return heading.kind === "own" ? t("ownGroup") : t("otherGroup");
}

function PickerGroup({
  children,
  hint,
  id,
  title,
}: {
  children: ReactNode;
  hint: Nullable<string>;
  id: string;
  title: ReactNode;
}) {
  const headingId = `${id}-heading`;
  const hintId = `${id}-hint`;

  return (
    <div
      aria-describedby={hint === null ? undefined : hintId}
      aria-labelledby={headingId}
      role="group"
    >
      <div
        aria-hidden
        className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground"
        id={headingId}
      >
        {title}
      </div>
      {hint === null ? null : (
        <div aria-hidden className="px-2 pb-1.5 text-xs text-muted-foreground" id={hintId}>
          {hint}
        </div>
      )}
      {children}
    </div>
  );
}

function PickerNotice({ notice, onRetry }: { notice: SpeciesPickerNotice; onRetry: () => void }) {
  const t = useTranslations("species.picker");
  const noticeText = useSpeciesPickerNoticeText();

  return (
    <div className={cn("flex items-center gap-2 px-2 py-1.5 text-xs", NOTICE_TONE[notice])}>
      {notice === "loading" ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : null}
      <span className="min-w-0 flex-1">{noticeText(notice)}</span>
      {notice === "loadFailed" ? (
        <button
          className="shrink-0 cursor-pointer rounded-sm font-medium text-foreground underline-offset-4 hover:underline"
          onClick={onRetry}
          tabIndex={-1}
          type="button"
        >
          {t("retry")}
        </button>
      ) : null}
    </div>
  );
}

function PickerOption({ active, children, id, onHighlight, onPick, selected }: PickerOptionProps) {
  return (
    <button
      aria-selected={active}
      className="relative flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden select-none aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:ring-1 aria-selected:ring-ring"
      id={id}
      onClick={onPick}
      onPointerMove={onHighlight}
      role="option"
      tabIndex={-1}
      type="button"
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {selected ? <UiIcon className="shrink-0" name="check" size={16} /> : null}
    </button>
  );
}
