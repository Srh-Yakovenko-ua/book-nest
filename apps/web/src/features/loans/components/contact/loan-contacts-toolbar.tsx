"use client";

import type { LoanContactCounts } from "@app/shared";

import { useTranslations } from "next-intl";

import type { LoanContactsControllerListStatus } from "@/shared/api/generated/model";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { ChipGroup } from "@/components/ui/chip-group";

import { LOAN_CONTACTS_STATUS_VALUES } from "../../model/loan-contacts-query";

type LoanContactsToolbarProps = {
  counts?: LoanContactCounts;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  onStatusSelect: (value: LoanContactsControllerListStatus) => void;
  search: string;
  status: LoanContactsControllerListStatus;
};

export function LoanContactsToolbar({
  counts,
  onSearchChange,
  onSearchClear,
  onStatusSelect,
  search,
  status,
}: LoanContactsToolbarProps) {
  const t = useTranslations("loans.contactsPage.toolbar");

  return (
    <div className="flex flex-col gap-4">
      <DebouncedSearchInput
        clearLabel={t("searchClear")}
        label={t("searchLabel")}
        onClear={onSearchClear}
        onSearch={onSearchChange}
        placeholder={t("searchPlaceholder")}
        value={search}
      />

      <div className="-mx-1 -my-1 no-scrollbar overflow-x-auto px-1 py-1">
        <ChipGroup
          className="flex-nowrap"
          label={t("statusLabel")}
          mode="single"
          onValueChange={(next) => {
            const match = LOAN_CONTACTS_STATUS_VALUES.find((value) => value === next);
            if (match !== undefined) onStatusSelect(match);
          }}
          options={LOAN_CONTACTS_STATUS_VALUES.map((value) => ({
            count: counts?.[value],
            label: t(`status.${value}`),
            value,
          }))}
          size="sm"
          value={status}
        />
      </div>
    </div>
  );
}
