"use client";

import type {
  BulkPagesCountFailureReason,
  BulkPagesCountResult,
  Nullable,
  ReadingQueueItemView,
  UpdatePagesCountItem,
} from "@app/shared";
import type { Control, UseFormRegister, UseFormSetValue } from "react-hook-form";

import { BookPagesCountSchema, QUEUE_VOLUME_BULK_MAX } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Controller, useFieldArray, useForm, useFormState, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import type { BooksControllerListFormatItem } from "@/shared/api/generated/model";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";
import { cn } from "@/lib/utils";

import type { QueueVolumeGapReason } from "../model/queue-volume";

import { useBulkUpdatePagesCount } from "../api/use-queue-volume";
import { LIBRARY_FORMAT_VALUES } from "../model/library-query";
import { queueVolumeGapReason } from "../model/queue-volume";
import {
  EMPTY_QUEUE_FILTERS,
  matchesQueueFilters,
  matchesQueueSearch,
} from "../model/reading-queue-filters";
import { DiscardConfirmDialog } from "./discard-confirm-dialog";

const FILTERS_ROW_THRESHOLD = 10;

const PAGES_MIN = BookPagesCountSchema.minValue ?? 1;
const PAGES_MAX = BookPagesCountSchema.maxValue ?? Number.MAX_SAFE_INTEGER;

const PAPER_FORMAT = "paper";

const REASON_KEYS = {
  invalid_progress: "reason.invalidProgress",
  missing_page_count: "reason.missingPageCount",
} as const satisfies Record<QueueVolumeGapReason, string>;

type QueueVolumeDataDialogProps = {
  items: ReadingQueueItemView[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type RowMeta = {
  currentPage: number;
  item: ReadingQueueItemView;
  reason: QueueVolumeGapReason;
};

type SubmitNotice =
  { count: number; kind: "notFound" } | { kind: "nothingToSave" } | { kind: "tooMany" };

type VolumeFormValues = {
  rows: VolumeRowValue[];
};

type VolumeRowValue = {
  bookId: string;
  expectedUpdatedAt: string;
  pagesCount: string;
  unavailable: boolean;
};

export function QueueVolumeDataDialog({ items, onOpenChange, open }: QueueVolumeDataDialogProps) {
  const t = useTranslations("readingQueue.volumeModal");
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  function close() {
    setDirty(false);
    setDiscardOpen(false);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog
        onOpenChange={(next) => {
          if (next) {
            onOpenChange(true);
            return;
          }
          if (dirty) {
            setDiscardOpen(true);
            return;
          }
          close();
        }}
        open={open}
      >
        <DialogContent className="flex max-h-[85dvh] flex-col gap-4 overflow-hidden max-sm:h-dvh max-sm:max-w-none max-sm:rounded-none sm:max-w-2xl">
          {open ? (
            <VolumeDataForm items={items} onDirty={() => setDirty(true)} onDone={close} />
          ) : null}
        </DialogContent>
      </Dialog>

      <DiscardConfirmDialog
        description={t("discard.description")}
        onConfirm={close}
        onOpenChange={setDiscardOpen}
        open={discardOpen}
        title={t("discard.title")}
      />
    </>
  );
}

function buildRowSchema({
  messages,
  metaByBookId,
}: {
  messages: {
    belowCurrentPage: (currentPage: number) => string;
    invalidNumber: string;
    tooBig: string;
    tooSmall: string;
  };
  metaByBookId: Map<string, RowMeta>;
}) {
  return z.object({
    rows: z.array(
      z
        .object({
          bookId: z.string(),
          expectedUpdatedAt: z.string(),
          pagesCount: z.string(),
          unavailable: z.boolean(),
        })
        .superRefine((row, ctx) => {
          if (row.unavailable) return;

          const raw = row.pagesCount.trim();
          if (raw === "") return;

          const value = Number(raw);
          if (!Number.isInteger(value)) {
            ctx.addIssue({ code: "custom", message: messages.invalidNumber, path: ["pagesCount"] });
            return;
          }

          if (value < PAGES_MIN) {
            ctx.addIssue({ code: "custom", message: messages.tooSmall, path: ["pagesCount"] });
            return;
          }

          if (value > PAGES_MAX) {
            ctx.addIssue({ code: "custom", message: messages.tooBig, path: ["pagesCount"] });
            return;
          }

          const currentPage = metaByBookId.get(row.bookId)?.currentPage ?? 0;
          if (value < currentPage) {
            ctx.addIssue({
              code: "custom",
              message: messages.belowCurrentPage(currentPage),
              path: ["pagesCount"],
            });
          }
        }),
    ),
  });
}

function buildSeed(items: ReadingQueueItemView[]) {
  const metaByBookId = new Map<string, RowMeta>();
  const rows: VolumeRowValue[] = [];

  for (const item of items) {
    const reason = queueVolumeGapReason(item.book);
    if (reason === null) continue;

    metaByBookId.set(item.book.id, {
      currentPage: item.book.readingProgress?.currentPage ?? 0,
      item,
      reason,
    });
    rows.push({
      bookId: item.book.id,
      expectedUpdatedAt: item.book.updatedAt,
      pagesCount: "",
      unavailable: false,
    });
  }

  return { metaByBookId, rows };
}

function canMarkUnavailable(book: ReadingQueueItemView["book"]): boolean {
  return !book.formats.includes(PAPER_FORMAT);
}

function FilledProgress({ control }: { control: Control<VolumeFormValues> }) {
  const t = useTranslations("readingQueue.volumeModal");
  const rows = useWatch({ control, name: "rows" });
  const filled = rows.filter((row) => row.unavailable || row.pagesCount.trim() !== "").length;

  return (
    <p className="text-xs text-muted-foreground tabular-nums">
      {t("progress", { filled, total: rows.length })}
    </p>
  );
}

function toBulkItems(rows: VolumeRowValue[]): UpdatePagesCountItem[] {
  return rows.flatMap((row): UpdatePagesCountItem[] => {
    if (row.unavailable) {
      return [
        {
          bookId: row.bookId,
          expectedUpdatedAt: row.expectedUpdatedAt,
          kind: "pages_count_unavailable",
        },
      ];
    }

    const raw = row.pagesCount.trim();
    if (raw === "") return [];

    return [
      {
        bookId: row.bookId,
        expectedUpdatedAt: row.expectedUpdatedAt,
        kind: "pages_count",
        pagesCount: Number(raw),
      },
    ];
  });
}

function VolumeDataForm({
  items,
  onDirty,
  onDone,
}: {
  items: ReadingQueueItemView[];
  onDirty: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("readingQueue.volumeModal");
  const tFormat = useTranslations("books.format.options");
  const tActions = useTranslations("books.actions");

  const [seed] = useState(() => buildSeed(items));
  const [search, setSearch] = useState("");
  const [format, setFormat] = useState<Nullable<BooksControllerListFormatItem>>(null);
  const [rowFailures, setRowFailures] = useState<Record<string, BulkPagesCountFailureReason>>({});
  const [notice, setNotice] = useState<Nullable<SubmitNotice>>(null);

  const bulkUpdate = useBulkUpdatePagesCount();

  const { control, handleSubmit, register, setValue } = useForm<VolumeFormValues>({
    defaultValues: { rows: seed.rows },
    mode: "onTouched",
    resolver: zodResolver(
      buildRowSchema({
        messages: {
          belowCurrentPage: (currentPage) => t("errors.belowCurrentPage", { count: currentPage }),
          invalidNumber: t("errors.invalidNumber"),
          tooBig: t("errors.tooBig", { max: PAGES_MAX }),
          tooSmall: t("errors.tooSmall"),
        },
        metaByBookId: seed.metaByBookId,
      }),
    ),
    reValidateMode: "onChange",
  });

  const { fields, remove } = useFieldArray({ control, name: "rows" });

  const normalizedQuery = search.trim().toLowerCase();
  const filterState = { ...EMPTY_QUEUE_FILTERS, format: format === null ? [] : [format] };
  const showFilters = fields.length > FILTERS_ROW_THRESHOLD;

  function isVisible(meta: RowMeta): boolean {
    if (!showFilters) return true;
    if (normalizedQuery !== "" && !matchesQueueSearch(meta.item, normalizedQuery)) return false;
    return matchesQueueFilters(meta.item.book, filterState);
  }

  const visibleCount = fields.filter((field) => {
    const meta = seed.metaByBookId.get(field.bookId);
    return meta !== undefined && isVisible(meta);
  }).length;

  const showUnavailableHint = fields.some((field) => {
    const meta = seed.metaByBookId.get(field.bookId);
    return meta !== undefined && isVisible(meta) && canMarkUnavailable(meta.item.book);
  });

  function applyResult(result: BulkPagesCountResult) {
    const notFoundIds = result.failed
      .filter((failure) => failure.reason === "not_found")
      .map((failure) => failure.bookId);
    const removedIds = new Set([...result.updated, ...notFoundIds]);

    const removedIndexes = fields.flatMap((field, index) =>
      removedIds.has(field.bookId) ? [index] : [],
    );
    const remaining = fields.filter((field) => !removedIds.has(field.bookId));

    const failures: Record<string, BulkPagesCountFailureReason> = {};
    for (const failure of result.failed) {
      if (failure.reason === "not_found") continue;
      failures[failure.bookId] = failure.reason;
    }

    if (removedIndexes.length > 0) remove(removedIndexes);
    setRowFailures(failures);

    if (remaining.length === 0) {
      toast.success(t("saved"));
      onDone();
      return;
    }

    setNotice(notFoundIds.length === 0 ? null : { count: notFoundIds.length, kind: "notFound" });

    if (result.updated.length === 0) {
      toast.error(t("errors.notSaved"));
      return;
    }
    toast.success(t("savedPartial", { count: result.updated.length }));
  }

  const onSubmit = handleSubmit((values) => {
    setRowFailures({});
    setNotice(null);

    const payload = toBulkItems(values.rows);
    if (payload.length === 0) {
      setNotice({ kind: "nothingToSave" });
      return;
    }
    if (payload.length > QUEUE_VOLUME_BULK_MAX) {
      setNotice({ kind: "tooMany" });
      return;
    }

    bulkUpdate.mutate(
      { items: payload },
      {
        onError: () => toast.error(t("errors.generic")),
        onSuccess: applyResult,
      },
    );
  });

  return (
    <form
      className="flex min-h-0 flex-1 flex-col gap-4"
      noValidate
      onChange={onDirty}
      onSubmit={onSubmit}
    >
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>

      {showUnavailableHint ? (
        <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <UiIcon aria-hidden className="mt-px shrink-0" name="info" size={14} />
          {t("unavailableHint")}
        </p>
      ) : null}

      {showFilters ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label={t("searchLabel")}
            className="h-9 sm:flex-1"
            isClearable
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
            placeholder={t("searchPlaceholder")}
            type="search"
            value={search}
          />
          <Select
            onValueChange={(next) =>
              setFormat(LIBRARY_FORMAT_VALUES.find((value) => value === next) ?? null)
            }
            value={format ?? "all"}
          >
            <SelectTrigger
              aria-label={t("formatLabel")}
              className="w-full data-[size=default]:h-9 sm:w-44"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("formatAll")}</SelectItem>
              {LIBRARY_FORMAT_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {tFormat(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="-mx-6 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6">
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : visibleCount === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noResults")}</p>
        ) : null}

        <ul className="flex flex-col gap-3">
          {fields.map((field, index) => {
            const meta = seed.metaByBookId.get(field.bookId);
            if (meta === undefined) return null;

            return (
              <VolumeRow
                control={control}
                failure={rowFailures[field.bookId] ?? null}
                hidden={!isVisible(meta)}
                index={index}
                key={field.id}
                meta={meta}
                register={register}
                setValue={setValue}
              />
            );
          })}
        </ul>
      </div>

      {notice === null ? null : (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {notice.kind === "notFound"
            ? t("errors.notFound", { count: notice.count })
            : notice.kind === "tooMany"
              ? t("errors.tooMany", { max: QUEUE_VOLUME_BULK_MAX })
              : t("errors.nothingToSave")}
        </p>
      )}

      <DialogFooter className="items-center gap-3 sm:justify-between">
        <FilledProgress control={control} />
        <div className="flex gap-2">
          <Button
            disabled={bulkUpdate.isPending}
            onClick={onDone}
            type="button"
            variant="secondary"
          >
            {tActions("cancel")}
          </Button>
          <Button disabled={bulkUpdate.isPending} loading={bulkUpdate.isPending} type="submit">
            {t("submit")}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

function VolumeRow({
  control,
  failure,
  hidden,
  index,
  meta,
  register,
  setValue,
}: {
  control: Control<VolumeFormValues>;
  failure: Nullable<BulkPagesCountFailureReason>;
  hidden: boolean;
  index: number;
  meta: RowMeta;
  register: UseFormRegister<VolumeFormValues>;
  setValue: UseFormSetValue<VolumeFormValues>;
}) {
  const t = useTranslations("readingQueue.volumeModal");
  const pagesId = useId();
  const unavailableId = useId();
  const errorId = useId();
  const failureId = useId();

  const { errors } = useFormState({ control, name: `rows.${index}.pagesCount` });
  const error = errors.rows?.[index]?.pagesCount;
  const unavailable = useWatch({ control, name: `rows.${index}.unavailable` });

  const describedBy = [error === undefined ? null : errorId, failure === null ? null : failureId]
    .filter((value) => value !== null)
    .join(" ");

  return (
    <li
      className={cn(
        "flex flex-col gap-2.5 rounded-lg border border-border p-3",
        failure !== null && "border-destructive/40 bg-destructive/5",
        hidden && "hidden",
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate text-sm font-medium text-ink" title={meta.item.book.title}>
          {meta.item.book.title}
        </p>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <UiIcon
            aria-hidden
            name={meta.reason === "invalid_progress" ? "alert-triangle" : "help-circle"}
            size={13}
          />
          {t(REASON_KEYS[meta.reason])}
          {meta.currentPage > 0 ? ` · ${t("currentPage", { count: meta.currentPage })}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-2.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={pagesId}>{t("pagesLabel")}</Label>
          <Input
            aria-describedby={describedBy === "" ? undefined : describedBy}
            aria-invalid={error !== undefined}
            className="h-9 w-32"
            disabled={unavailable}
            id={pagesId}
            inputMode="numeric"
            max={PAGES_MAX}
            min={PAGES_MIN}
            onKeyDown={blockNegativeNumberKeys}
            onPaste={blockNegativeNumberPaste}
            placeholder={t("pagesPlaceholder")}
            step={1}
            type="number"
            {...register(`rows.${index}.pagesCount`)}
          />
        </div>

        {canMarkUnavailable(meta.item.book) ? (
          <Controller
            control={control}
            name={`rows.${index}.unavailable`}
            render={({ field }) => (
              <label
                className="flex cursor-pointer items-center gap-2 pb-2.5"
                htmlFor={unavailableId}
              >
                <Checkbox
                  checked={field.value}
                  id={unavailableId}
                  onCheckedChange={(checked) => {
                    const next = checked === true;
                    field.onChange(next);
                    if (next) setValue(`rows.${index}.pagesCount`, "", { shouldValidate: true });
                  }}
                />
                <span className="text-sm text-foreground">{t("unavailableLabel")}</span>
              </label>
            )}
          />
        ) : null}
      </div>

      <FieldError error={error} id={errorId} />

      {failure === null ? null : (
        <p className="inline-flex items-center gap-1.5 text-xs text-destructive" id={failureId}>
          <UiIcon aria-hidden name="alert-circle" size={13} />
          {failure === "stale"
            ? t("failure.stale")
            : t("errors.belowCurrentPage", { count: meta.currentPage })}
        </p>
      )}
    </li>
  );
}
