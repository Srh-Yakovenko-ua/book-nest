import type { BooksControllerListSort } from "@/shared/api/generated/model";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { LIBRARY_SORT_DEFAULT } from "../model/library-query";

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
    <div className="w-full sm:w-60">
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
  );
}
