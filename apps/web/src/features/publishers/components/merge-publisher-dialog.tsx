"use client";

import type { Nullable, PublisherView } from "@app/shared";
import type { RefObject } from "react";

import { PUBLISHER_MERGE_ERROR_CODES } from "@app/shared";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { usePublishersSearch } from "@/features/books/api/use-publishers-search";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/http-client";

import { useMergePublisher } from "../api/use-merge-publisher";

const MERGE_DIALOG = {
  forbiddenStatus: 403,
  linkedBooksStatus: 409,
  notFoundStatus: 404,
  searchDebounceMs: 250,
  searchInputId: "merge-publisher-search",
} as const;

type MergeFailureReason = "generic" | "globalSource" | "linkedBooks" | "notFound" | "samePublisher";

type MergePublisherDialogProps = {
  booksCount: number;
  onCloseAutoFocus: (event: Event) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  publisherId: string;
  publisherName: string;
};

type MergeTargetPickerProps = {
  disabled: boolean;
  excludedPublisherId: string;
  inputRef: RefObject<Nullable<HTMLInputElement>>;
  onSelect: (publisher: PublisherView) => void;
  selectedPublisherId: Nullable<string>;
};

export function MergePublisherDialog({
  booksCount,
  onCloseAutoFocus,
  onOpenChange,
  open,
  publisherId,
  publisherName,
}: MergePublisherDialogProps) {
  const t = useTranslations("publishers.details.mergeDialog");
  const tErrors = useTranslations("publishers.details.mergeDialog.errors");
  const tToast = useTranslations("publishers.details.toast");
  const router = useRouter();
  const mergePublisher = useMergePublisher(publisherId);
  const [target, setTarget] = useState<Nullable<PublisherView>>(null);
  const [failure, setFailure] = useState<Nullable<MergeFailureReason>>(null);
  const searchInputRef = useRef<Nullable<HTMLInputElement>>(null);

  function close() {
    setTarget(null);
    setFailure(null);
    onOpenChange(false);
  }

  function confirmMerge() {
    if (target === null) return;
    setFailure(null);
    mergePublisher.mutate(
      { targetPublisherId: target.id },
      {
        onError: (error) => setFailure(mergeFailureReason(error)),
        onSuccess: (result) => {
          toast.success(tToast("merged", { count: result.movedBooksCount }));
          close();
          router.replace(`/publishers/${result.targetPublisherId}`);
        },
      },
    );
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (mergePublisher.isPending) return;
        if (next) {
          onOpenChange(true);
          return;
        }
        close();
      }}
      open={open}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"
        onCloseAutoFocus={onCloseAutoFocus}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchInputRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {open ? (
          <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/40 p-3">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t("sourceLabel")}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <UiIcon aria-hidden className="shrink-0 text-icon" name="building" size={16} />
                <span className="min-w-0 text-sm font-medium break-words text-foreground">
                  {publisherName}
                </span>
                <Badge variant="secondary">{t("ownBadge")}</Badge>
              </div>
              {booksCount > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("sourceBooks", { count: booksCount })}
                </p>
              ) : null}
            </section>

            <div className="flex flex-col gap-2">
              <Label htmlFor={MERGE_DIALOG.searchInputId}>{t("searchLabel")}</Label>
              <MergeTargetPicker
                disabled={mergePublisher.isPending}
                excludedPublisherId={publisherId}
                inputRef={searchInputRef}
                onSelect={setTarget}
                selectedPublisherId={target?.id ?? null}
              />
            </div>

            {target === null ? null : (
              <section className="flex flex-col gap-1.5 rounded-xl border border-accent-border bg-accent/50 p-3">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t("previewLabel")}
                </span>
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                  <span className="min-w-0 break-words">{publisherName}</span>
                  <UiIcon aria-hidden className="shrink-0 text-icon" name="arrow-right" size={16} />
                  <span className="min-w-0 break-words">{target.name}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("previewNote", { name: target.name })}
                </p>
              </section>
            )}

            <div aria-live="polite" className="empty:hidden">
              {failure === null ? null : (
                <p className="rounded-md bg-error-soft px-3 py-2 text-sm text-error">
                  {tErrors(failure)}
                </p>
              )}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            disabled={mergePublisher.isPending}
            onClick={close}
            type="button"
            variant="secondary"
          >
            {t("cancel")}
          </Button>
          <Button
            disabled={target === null || mergePublisher.isPending}
            loading={mergePublisher.isPending}
            onClick={confirmMerge}
            type="button"
          >
            {mergePublisher.isPending ? t("merging") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function mergeFailureReason(error: unknown): MergeFailureReason {
  if (!(error instanceof ApiError)) return "generic";
  if (error.code === PUBLISHER_MERGE_ERROR_CODES.samePublisher) return "samePublisher";
  if (error.status === MERGE_DIALOG.forbiddenStatus) return "globalSource";
  if (error.status === MERGE_DIALOG.notFoundStatus) return "notFound";
  if (error.status === MERGE_DIALOG.linkedBooksStatus) return "linkedBooks";
  return "generic";
}

function MergeTargetPicker({
  disabled,
  excludedPublisherId,
  inputRef,
  onSelect,
  selectedPublisherId,
}: MergeTargetPickerProps) {
  const t = useTranslations("publishers.details.mergeDialog");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, MERGE_DIALOG.searchDebounceMs);
  const { fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, items } =
    usePublishersSearch(debouncedQuery);
  const options = items.filter((publisher) => publisher.id !== excludedPublisherId);
  const { onScroll, scrollRef } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    itemCount: options.length,
    onLoadMore: fetchNextPage,
  });

  return (
    <Command
      className="rounded-xl! border border-border bg-background"
      label={t("searchLabel")}
      shouldFilter={false}
    >
      <CommandInput
        disabled={disabled}
        id={MERGE_DIALOG.searchInputId}
        onValueChange={setQuery}
        placeholder={t("searchPlaceholder")}
        ref={inputRef}
        value={query}
      />
      <CommandList className="max-h-56" onScroll={onScroll} ref={scrollRef}>
        {options.length === 0 ? (
          <CommandEmpty>{isFetching ? t("searching") : t("empty")}</CommandEmpty>
        ) : null}
        {options.map((publisher) => (
          <CommandItem
            className="cursor-pointer items-start"
            data-checked={selectedPublisherId === publisher.id}
            disabled={disabled}
            key={publisher.id}
            onSelect={() => onSelect(publisher)}
            value={publisher.id}
          >
            <UiIcon aria-hidden className="shrink-0 text-icon" name="building" size={16} />
            <span className="min-w-0 break-words whitespace-normal">{publisher.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {publisher.isCustom ? t("ownBadge") : t("catalogBadge")}
            </span>
          </CommandItem>
        ))}
        {isFetchingNextPage ? (
          <p className="px-2 py-1.5 text-center text-xs text-muted-foreground">{t("searching")}</p>
        ) : null}
      </CommandList>
    </Command>
  );
}
