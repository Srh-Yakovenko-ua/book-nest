"use client";

import type { KeyboardEvent, PointerEvent } from "react";

import { type CharacterCustomLabelUsageView, normalizeName, type Nullable } from "@app/shared";
import { Command as CommandPrimitive } from "cmdk";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { CharacterEditValues } from "../model/character-edit-form";

import { BOOK_CHARACTER_ROLE } from "../model/character-options";
import { CharacterRoleChip } from "./character-role-chip";

type CharacterRolePickerProps = {
  customRoles: readonly CharacterCustomLabelUsageView[];
  onChange: (roles: RoleRow[]) => void;
  value: RoleRow[];
};

type RoleRow = CharacterEditValues["book"]["roles"][number];

const ROLE_ITEM_CLASS_NAME =
  "cursor-pointer data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[selected=true]:ring-1 data-[selected=true]:ring-ring [&>svg:last-child]:hidden";

export function CharacterRolePicker({ customRoles, onChange, value }: CharacterRolePickerProps) {
  const t = useTranslations("characters.rolePicker");
  const tForm = useTranslations("characters.form");
  const tRole = useTranslations("characters.roleType");
  const hintId = useId();
  const countId = useId();
  const anchorRef = useRef<Nullable<HTMLDivElement>>(null);
  const inputRef = useRef<Nullable<HTMLInputElement>>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const { limits } = BOOK_CHARACTER_ROLE;
  const atLimit = value.length >= limits.perBook;
  const listOpen = open && !atLimit;
  const query = normalizeName(search);
  const customName = search.trim();
  const placeholder = atLimit ? t("atMax") : t("placeholder");
  const selectedTypes = new Set(value.map((role) => role.roleType));
  const standardRoles = BOOK_CHARACTER_ROLE.options
    .filter((roleType) => roleType !== BOOK_CHARACTER_ROLE.custom)
    .map((roleType) => ({ label: tRole(roleType), roleType }));
  const suggestions = standardRoles.filter(
    ({ label, roleType }) => !selectedTypes.has(roleType) && normalizeName(label).includes(query),
  );
  const standardNames = new Set(standardRoles.map(({ label }) => normalizeName(label)));
  const selectedNames = new Set(value.map((role) => normalizeName(labelOf(role))));
  const customSuggestions = customRoles.filter(({ label }) => {
    const name = normalizeName(label);
    return !standardNames.has(name) && !selectedNames.has(name) && name.includes(query);
  });
  const alreadyAddedRole =
    query.length > 0 ? value.find((role) => normalizeName(labelOf(role)) === query) : undefined;
  const canCreateCustom =
    customName.length > 0 &&
    alreadyAddedRole === undefined &&
    !standardNames.has(query) &&
    customRoles.every(({ label }) => normalizeName(label) !== query);

  function labelOf(role: RoleRow) {
    const name = role.customRole.trim();
    if (role.roleType === BOOK_CHARACTER_ROLE.custom && name.length > 0) return name;
    return tRole(role.roleType);
  }

  function add(role: RoleRow) {
    if (atLimit) return;
    onChange([...value, role]);
    setAnnouncement(
      t("announceAdded", { count: value.length + 1, max: limits.perBook, role: labelOf(role) }),
    );
    setSearch("");
    inputRef.current?.focus();
  }

  function removeAt(index: number) {
    const removed = value[index];
    if (removed === undefined) return;
    onChange(value.filter((_, current) => current !== index));
    setAnnouncement(
      t("announceRemoved", {
        count: value.length - 1,
        max: limits.perBook,
        role: labelOf(removed),
      }),
    );
  }

  function toggleSpoilerAt(index: number) {
    onChange(
      value.map((role, current) =>
        current === index ? { ...role, isSpoiler: !role.isSpoiler } : role,
      ),
    );
  }

  function openFromContainer(event: PointerEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest("button, input")) return;
    event.preventDefault();
    inputRef.current?.focus();
    setOpen(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Home" || event.key === "End") event.stopPropagation();
    if (event.key === "ArrowDown") setOpen(true);
    if (event.key !== "Backspace" || search !== "" || value.length === 0) return;
    event.preventDefault();
    removeAt(value.length - 1);
  }

  return (
    <CommandPrimitive className="flex flex-col gap-1.5" label={tForm("roles")} shouldFilter={false}>
      <Popover onOpenChange={setOpen} open={listOpen}>
        <PopoverAnchor asChild>
          <div
            className={cn(
              "relative flex min-h-12 cursor-text flex-wrap items-center gap-2 rounded-md border border-input bg-field py-2 pl-2.5 transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
              atLimit ? "pr-2.5" : "pr-9",
            )}
            onPointerDown={openFromContainer}
            ref={anchorRef}
          >
            {value.map((role, index) => (
              <CharacterRoleChip
                isSpoiler={role.isSpoiler}
                key={`${role.roleType}::${normalizeName(role.customRole)}`}
                label={labelOf(role)}
                onRemove={() => {
                  removeAt(index);
                  inputRef.current?.focus();
                }}
                onToggleSpoiler={() => toggleSpoilerAt(index)}
              />
            ))}
            <div
              className={cn(
                "relative h-7 max-w-full min-w-fit flex-1 text-[0.9375rem]",
                atLimit && "basis-full",
              )}
            >
              <span
                aria-hidden
                className="invisible block h-7 overflow-hidden"
                data-slot="placeholder-sizer"
              >
                {placeholder}
              </span>
              <CommandPrimitive.Input
                aria-describedby={`${hintId} ${countId}`}
                className="absolute inset-0 w-full border-0 bg-transparent text-[0.9375rem] text-ink outline-none placeholder:text-muted-foreground read-only:cursor-not-allowed"
                maxLength={limits.customNameMaxLength}
                onClick={() => setOpen(true)}
                onFocus={() => setOpen(true)}
                onKeyDown={handleKeyDown}
                onValueChange={(next) => {
                  setSearch(next);
                  setOpen(true);
                }}
                placeholder={placeholder}
                readOnly={atLimit}
                ref={inputRef}
                value={search}
              />
              {atLimit ? null : (
                <UiIcon
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute top-1/2 left-full ml-2 -translate-y-1/2 text-muted-foreground transition-transform",
                    listOpen && "rotate-180",
                  )}
                  name="chevron-down"
                  size={16}
                />
              )}
            </div>
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) max-w-(--radix-popover-trigger-width) p-1"
          onInteractOutside={(event) => {
            const target = event.detail.originalEvent.target;
            if (target instanceof Node && anchorRef.current?.contains(target)) {
              event.preventDefault();
            }
          }}
          onOpenAutoFocus={(event) => event.preventDefault()}
          role="presentation"
          sideOffset={6}
        >
          <CommandList label={t("listLabel")}>
            {alreadyAddedRole === undefined ? null : (
              <CommandEmpty>{t("alreadyAdded", { name: labelOf(alreadyAddedRole) })}</CommandEmpty>
            )}
            {suggestions.length > 0 ? (
              <CommandGroup heading={t("suggestionsHeading")}>
                {suggestions.map(({ label, roleType }) => (
                  <CommandItem
                    className={ROLE_ITEM_CLASS_NAME}
                    key={roleType}
                    onSelect={() => add({ customRole: "", isSpoiler: false, roleType })}
                    value={roleType}
                  >
                    {label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {customSuggestions.length > 0 ? (
              <CommandGroup heading={t("customHeading")}>
                {customSuggestions.map(({ count, label }) => (
                  <CommandItem
                    className={ROLE_ITEM_CLASS_NAME}
                    key={label}
                    onSelect={() =>
                      add({
                        customRole: label,
                        isSpoiler: false,
                        roleType: BOOK_CHARACTER_ROLE.custom,
                      })
                    }
                    value={`custom-role::${label}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    <span
                      aria-hidden
                      className="shrink-0 text-xs text-muted-foreground tabular-nums"
                    >
                      {count}
                    </span>
                    <span className="sr-only">{t("usageCount", { count })}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {canCreateCustom ? (
              <CommandGroup heading={t("createHeading")}>
                <CommandItem
                  className={ROLE_ITEM_CLASS_NAME}
                  onSelect={() =>
                    add({
                      customRole: customName,
                      isSpoiler: false,
                      roleType: BOOK_CHARACTER_ROLE.custom,
                    })
                  }
                  value="create-custom-role"
                >
                  <UiIcon className="text-primary" name="plus" size={16} />
                  <span className="min-w-0 truncate">{t("create", { name: customName })}</span>
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </PopoverContent>
      </Popover>
      <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
        <p id={hintId}>
          {t("hint", { max: limits.perBook })}
          {atLimit ? <span className="sr-only"> {t("atMax")}</span> : null}
        </p>
        <span className="shrink-0 tabular-nums" id={countId}>
          {t("count", { count: value.length, max: limits.perBook })}
        </span>
      </div>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </CommandPrimitive>
  );
}
