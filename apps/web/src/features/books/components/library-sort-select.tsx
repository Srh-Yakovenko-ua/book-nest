import type { BooksControllerListSort } from "@/shared/api/generated/model";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    <Select onValueChange={(next) => onChange(next as BooksControllerListSort)} value={value}>
      <SelectTrigger aria-label={label} className="h-10 w-52">
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
  );
}
