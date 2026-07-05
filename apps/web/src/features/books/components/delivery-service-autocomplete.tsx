"use client";

import type { DeliveryServiceView } from "@app/shared";

import { Command as CommandPrimitive } from "cmdk";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

import { useDeliveryServicesSearch } from "../api/use-delivery-services-search";
import { useRecentDeliveryServices } from "../api/use-recent-delivery-services";

type DeliveryServiceAutocompleteProps = {
  describedBy?: string;
  id: string;
  invalid: boolean;
  label: string;
  onChange: (next: string) => void;
  placeholder: string;
  value: string;
};

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

type DeliveryServiceOptionProps = {
  onSelect: () => void;
  service: DeliveryServiceView;
};

export function DeliveryServiceAutocomplete({
  describedBy,
  id,
  invalid,
  label,
  onChange,
  placeholder,
  value,
}: DeliveryServiceAutocompleteProps) {
  const t = useTranslations("books");
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebouncedValue(value, SEARCH_DEBOUNCE_MS);
  const { data: services = [], isFetching } = useDeliveryServicesSearch(debouncedQuery);
  const { data: recentServices = [] } = useRecentDeliveryServices();

  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();
  const filteredRecent =
    normalized.length === 0
      ? recentServices
      : recentServices.filter((service) => service.name.toLowerCase().includes(normalized));
  const recentIds = new Set(filteredRecent.map((service) => service.id));
  const catalogResults =
    normalized.length === 0 ? [] : services.filter((service) => !recentIds.has(service.id));

  const showCreateOption =
    trimmed.length >= MIN_QUERY_LENGTH &&
    ![...services, ...recentServices].some((service) => service.name.toLowerCase() === normalized);

  const hasResults = filteredRecent.length > 0 || catalogResults.length > 0;

  function pickService(name: string) {
    onChange(name);
    setOpen(false);
  }

  function handleClear() {
    onChange("");
    setOpen(false);
  }

  const showClear = value.length > 0;

  return (
    <CommandPrimitive label={label} shouldFilter={false}>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverAnchor asChild>
          <div className="relative flex items-center" ref={anchorRef}>
            <UiIcon
              aria-hidden
              className={cn(
                "pointer-events-none absolute left-3",
                invalid ? "text-destructive" : "text-muted-foreground",
              )}
              name="truck"
              size={18}
            />
            <CommandPrimitive.Input
              aria-describedby={describedBy}
              aria-invalid={invalid}
              autoComplete="off"
              className={cn(
                "h-10 w-full rounded-md border border-input bg-field pl-10 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm",
                showClear ? "pr-10" : "pr-3",
                invalid &&
                  "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
              )}
              id={id}
              onClick={() => setOpen(true)}
              onValueChange={(next) => {
                onChange(next);
                setOpen(true);
              }}
              placeholder={placeholder}
              value={value}
            />
            {showClear ? (
              <button
                aria-label={t("fields.clear")}
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
          className="w-[--radix-popover-trigger-width] min-w-[var(--radix-popover-anchor-width)] p-1"
          onInteractOutside={(event) => {
            const target = event.detail.originalEvent.target;
            if (target instanceof Node && anchorRef.current?.contains(target)) {
              event.preventDefault();
            }
          }}
          onOpenAutoFocus={(event) => event.preventDefault()}
          sideOffset={6}
        >
          <CommandList>
            {isFetching && !hasResults && normalized.length > 0 ? (
              <CommandEmpty>{t("deliveryService.searching")}</CommandEmpty>
            ) : null}
            {!isFetching && !hasResults && !showCreateOption ? (
              <CommandEmpty>{t("deliveryService.empty")}</CommandEmpty>
            ) : null}
            {filteredRecent.length > 0 ? (
              <CommandGroup heading={t("deliveryService.recentHeading")}>
                {filteredRecent.map((service) => (
                  <DeliveryServiceOption
                    key={service.id}
                    onSelect={() => pickService(service.name)}
                    service={service}
                  />
                ))}
              </CommandGroup>
            ) : null}
            {catalogResults.length > 0 ? (
              <CommandGroup heading={t("deliveryService.resultsHeading")}>
                {catalogResults.map((service) => (
                  <DeliveryServiceOption
                    key={service.id}
                    onSelect={() => pickService(service.name)}
                    service={service}
                  />
                ))}
              </CommandGroup>
            ) : null}
            {showCreateOption ? (
              <CommandGroup>
                <CommandItem
                  className="cursor-pointer"
                  onSelect={() => pickService(trimmed)}
                  value={`create-${trimmed}`}
                >
                  <UiIcon className="text-primary" name="plus" size={16} />
                  <span className="min-w-0 truncate">
                    {t("deliveryService.createNew", { name: trimmed })}
                  </span>
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </PopoverContent>
      </Popover>
    </CommandPrimitive>
  );
}

function DeliveryServiceOption({ onSelect, service }: DeliveryServiceOptionProps) {
  const t = useTranslations("books");
  return (
    <CommandItem className="cursor-pointer" onSelect={onSelect} value={service.id}>
      <UiIcon className="text-muted-foreground" name="truck" size={16} />
      <span className="min-w-0 truncate">{service.name}</span>
      {service.isCustom ? (
        <span className="ml-auto text-xs text-muted-foreground">
          {t("deliveryService.customBadge")}
        </span>
      ) : service.countryCode !== null ? (
        <span className="ml-auto text-xs text-muted-foreground uppercase">
          {service.countryCode}
        </span>
      ) : null}
    </CommandItem>
  );
}
