"use client";

import type { BookView, OwnershipStatus } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ownershipStatuses } from "@/lib/book-status";

import { useBulkOwnershipStatus } from "../api/use-book-actions";
import { useLibraryBooks } from "../api/use-books";
import { UNSET_OWNERSHIP, unsetOwnershipParams } from "../model/unset-ownership";
import { BookPickerResults, BookPickerSelected } from "./book-picker";
import { StatusChipGroup } from "./status-chip-group";

export function UnsetOwnershipDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const t = useTranslations("books.unsetOwnership");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>
        {open ? <UnsetOwnershipForm onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function UnsetOwnershipForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations("books.unsetOwnership");
  const tOptions = useTranslations("books.ownershipStatus.options");
  const tReading = useTranslations("books.readingStatus.options");
  const tCommon = useTranslations("common");

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<BookView[]>([]);
  const [status, setStatus] = useState<OwnershipStatus>(UNSET_OWNERSHIP.defaultStatus);
  const [isSelectingAll, setIsSelectingAll] = useState(false);
  const debouncedSearch = useDebouncedValue(search, UNSET_OWNERSHIP.searchDebounceMs);

  const setOwnership = useBulkOwnershipStatus();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } = useLibraryBooks(
    unsetOwnershipParams(debouncedSearch),
  );

  const results = (data?.pages ?? []).flatMap((page) => page.items);
  const selectedIds = new Set(selected.map((book) => book.id));

  const statusOptions = UNSET_OWNERSHIP.bulkStatuses.flatMap((value) => {
    const entry = ownershipStatuses.find((option) => option.value === value);
    if (entry === undefined) return [];
    return [{ icon: <UiIcon name={entry.icon} size={16} />, label: tOptions(value), value }];
  });

  function toggle(book: BookView) {
    setSelected((current) =>
      current.some((entry) => entry.id === book.id)
        ? current.filter((entry) => entry.id !== book.id)
        : [...current, book],
    );
  }

  async function selectAll() {
    setIsSelectingAll(true);
    try {
      let pages = data?.pages ?? [];
      let more = hasNextPage;
      while (more) {
        const nextResult = await fetchNextPage();
        pages = nextResult.data?.pages ?? pages;
        more = nextResult.hasNextPage;
      }
      setSelected(pages.flatMap((page) => page.items));
    } finally {
      setIsSelectingAll(false);
    }
  }

  function submit() {
    if (selected.length === 0) return;
    setOwnership.mutate(
      { bookIds: selected.map((book) => book.id), ownershipStatus: status },
      {
        onError: () => toast.error(t("error")),
        onSuccess: (result) => {
          toast.success(t("toast", { count: result.affected }));
          onDone();
        },
      },
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-ink">{t("library")}</h3>
          <Button
            disabled={results.length === 0 || isSelectingAll}
            loading={isSelectingAll}
            onClick={() => void selectAll()}
            size="sm"
            variant="ghost"
          >
            {t("selectAll")}
          </Button>
        </div>
        <div className="relative flex items-center">
          <UiIcon
            aria-hidden
            className="pointer-events-none absolute left-3 text-muted-foreground"
            name="search"
            size={18}
          />
          <Input
            aria-label={t("search")}
            autoComplete="off"
            className="h-10 pl-10"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("search")}
            value={search}
          />
        </div>
        <ScrollArea className="h-72 rounded-lg border border-border">
          <BookPickerResults
            emptyLabel={t("empty")}
            isPending={isPending}
            loadingLabel={tCommon("loading")}
            onToggle={toggle}
            readingLabel={(readingStatus) => tReading(readingStatus)}
            results={results}
            selectedIds={selectedIds}
          />
          {hasNextPage ? (
            <div className="px-2 pb-2">
              <Button
                className="w-full"
                loading={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
                size="sm"
                variant="outline"
              >
                {t("loadMore")}
              </Button>
            </div>
          ) : null}
        </ScrollArea>
      </section>

      <section className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-ink">
            {t("selected", { count: selected.length })}
          </h3>
          {selected.length > 0 ? (
            <Button onClick={() => setSelected([])} size="sm" variant="ghost">
              {t("clear")}
            </Button>
          ) : null}
        </div>
        <ScrollArea className="h-48 rounded-lg border border-border">
          <BookPickerSelected
            books={selected}
            emptyLabel={t("emptySelected")}
            onRemove={toggle}
            removeLabel={t("removeSelected")}
          />
        </ScrollArea>
        <StatusChipGroup
          label={t("statusLabel")}
          onValueChange={(next) => {
            const match = UNSET_OWNERSHIP.bulkStatuses.find((value) => value === next);
            if (match !== undefined) setStatus(match);
          }}
          options={statusOptions}
          value={status}
        />
        <Button
          disabled={selected.length === 0 || setOwnership.isPending}
          loading={setOwnership.isPending}
          onClick={submit}
        >
          {t("submit")}
        </Button>
      </section>
    </div>
  );
}
