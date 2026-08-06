import type { BooksControllerListSort } from "@/shared/api/generated/model";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { LIBRARY_SORT_DEFAULT } from "../model/library-query";
import { LibrarySortSheet } from "./library-sort-sheet";

export type LibrarySortOption = {
  label: string;
  value: BooksControllerListSort;
};

type LibrarySortSelectProps = {
  label: string;
  onChange: (value: BooksControllerListSort) => void;
  options: LibrarySortOption[];
  value: BooksControllerListSort;
};

export function LibrarySortSelect({ label, onChange, options, value }: LibrarySortSelectProps) {
  return (
    <>
      <LibrarySortSheet
        className="sm:hidden"
        label={label}
        onChange={onChange}
        options={options}
        value={value}
      />
      <div className="hidden sm:block sm:w-80">
        <Select onValueChange={(next) => onChange(next as BooksControllerListSort)} value={value}>
          <SelectTrigger
            aria-label={label}
            className="w-full data-[size=default]:h-10"
            isClearable={value !== LIBRARY_SORT_DEFAULT}
            onClear={() => onChange(LIBRARY_SORT_DEFAULT)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
