"use client";

import type { LoanContactView } from "@app/shared";

import { normalizeName } from "@app/shared";
import { Command as CommandPrimitive } from "cmdk";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

import type { LoanContactSelection } from "../model/loan-contact-selection";

import { useLoanContacts } from "../api/use-loan-contacts";
import { CreateLoanContactDialog } from "./contact/create-loan-contact-dialog";

type LoanContactOptionProps = {
  contact: LoanContactView;
  onSelect: () => void;
};

type LoanContactPickerProps = {
  describedBy?: string;
  id: string;
  invalid: boolean;
  label: string;
  onChange: (selection: LoanContactSelection | null) => void;
  placeholder: string;
  value: LoanContactSelection | null;
};

const SEARCH_DEBOUNCE_MS = 250;

export function LoanContactPicker({
  describedBy,
  id,
  invalid,
  label,
  onChange,
  placeholder,
  value,
}: LoanContactPickerProps) {
  const t = useTranslations("loans.contactPicker");
  const selectedName = value?.name ?? "";
  const [query, setQuery] = useState(selectedName);
  const [trackedName, setTrackedName] = useState(selectedName);
  const [open, setOpen] = useState(false);
  const [creatingName, setCreatingName] = useState<null | string>(null);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const { data: contacts = [], isFetching } = useLoanContacts(debouncedQuery);

  if (selectedName !== trackedName) {
    setTrackedName(selectedName);
    if (selectedName.length > 0 || query === trackedName) setQuery(selectedName);
  }

  const trimmedQuery = query.trim();
  const normalizedQuery = normalizeName(trimmedQuery);
  const searchSettled = !isFetching && debouncedQuery.trim() === trimmedQuery;
  const matchesExistingContact = contacts.some(
    (contact) => normalizeName(contact.name) === normalizedQuery,
  );
  const showCreateOption = trimmedQuery.length > 0 && searchSettled && !matchesExistingContact;
  const showClear = value !== null || query.length > 0;

  function pickContact(contact: LoanContactView) {
    onChange({ contactId: contact.id, kind: "picked", name: contact.name });
    setQuery(contact.name);
    setTrackedName(contact.name);
    setOpen(false);
  }

  function handleClear() {
    onChange(null);
    setQuery("");
    setTrackedName("");
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <CommandPrimitive label={label} shouldFilter={false}>
        <Popover onOpenChange={setOpen} open={open}>
          <PopoverAnchor asChild>
            <div className="relative flex items-center">
              <UiIcon
                aria-hidden
                className={cn(
                  "pointer-events-none absolute left-3",
                  invalid ? "text-destructive" : "text-muted-foreground",
                )}
                name="user"
                size={18}
              />
              <CommandPrimitive.Input
                aria-describedby={describedBy}
                aria-invalid={invalid}
                aria-required="true"
                autoComplete="off"
                className={cn(
                  "h-10 w-full rounded-md border border-input bg-field pl-10 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm",
                  showClear ? "pr-10" : "pr-3",
                  invalid &&
                    "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
                )}
                id={id}
                onClick={() => setOpen(true)}
                onFocus={() => setOpen(true)}
                onValueChange={(next) => {
                  setQuery(next);
                  setOpen(true);
                  if (value !== null) onChange(null);
                }}
                placeholder={placeholder}
                value={query}
              />
              {showClear ? (
                <button
                  aria-label={t("clear")}
                  className="absolute right-2 grid size-6 cursor-pointer place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  onClick={handleClear}
                  type="button"
                >
                  <UiIcon name="x" size={16} />
                </button>
              ) : null}
            </div>
          </PopoverAnchor>
          <PopoverContent
            align="start"
            className="w-(--radix-popover-trigger-width) max-w-(--radix-popover-trigger-width) p-1"
            onOpenAutoFocus={(event) => event.preventDefault()}
            sideOffset={6}
          >
            <CommandList>
              {isFetching && contacts.length === 0 ? (
                <CommandEmpty>{t("searching")}</CommandEmpty>
              ) : null}
              {!isFetching && contacts.length === 0 && !showCreateOption ? (
                <CommandEmpty>{t("empty")}</CommandEmpty>
              ) : null}
              {contacts.length > 0 ? (
                <CommandGroup heading={t("contactsHeading")}>
                  {contacts.map((contact) => (
                    <LoanContactOption
                      contact={contact}
                      key={contact.id}
                      onSelect={() => pickContact(contact)}
                    />
                  ))}
                </CommandGroup>
              ) : null}
              {showCreateOption ? (
                <CommandGroup heading={t("createHeading")}>
                  <CommandItem
                    className="cursor-pointer"
                    onSelect={() => {
                      setOpen(false);
                      setCreatingName(trimmedQuery);
                    }}
                    value={`create-${trimmedQuery}`}
                  >
                    <UiIcon className="text-primary" name="plus" size={16} />
                    <span className="min-w-0 truncate">
                      {t("createAction", { name: trimmedQuery })}
                    </span>
                  </CommandItem>
                </CommandGroup>
              ) : null}
            </CommandList>
          </PopoverContent>
        </Popover>
      </CommandPrimitive>

      <CreateLoanContactDialog
        conflictAction="select"
        initialName={creatingName ?? ""}
        onOpenChange={(next) => {
          if (!next) setCreatingName(null);
        }}
        onResolved={({ contact }) => {
          setCreatingName(null);
          pickContact(contact);
        }}
        open={creatingName !== null}
      />
    </div>
  );
}

function LoanContactOption({ contact, onSelect }: LoanContactOptionProps) {
  const t = useTranslations("loans.contactPicker");

  return (
    <CommandItem className="cursor-pointer" onSelect={onSelect} value={contact.id}>
      <UiIcon className="shrink-0 text-muted-foreground" name="user" size={16} />
      <span className="min-w-0 truncate">{contact.name}</span>
      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
        {t("loanCount", { count: contact.loanCount })}
      </span>
    </CommandItem>
  );
}
