"use client";

import { SERIES_DESCRIPTION_MAX } from "@app/shared";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";

import type { AuthorSelection, SeriesSelection } from "../model/create-book-form";

import { SERIES_STATUS_OPTIONS } from "../model/book-classification-fields";
import { authorSelectionToReference, NewSeriesInputSchema } from "../model/create-book-form";
import { AuthorsField } from "./authors-field";
import { StatusChipGroup } from "./status-chip-group";

const NAME_MAX = 120;
const DESCRIPTION_MAX = SERIES_DESCRIPTION_MAX;
const TOTAL_BOOKS_MIN = 1;
const TOTAL_BOOKS_MAX = 999;

type CreateSeriesDialogProps = {
  authorSelections: AuthorSelection[];
  initialName: string;
  onConfirm: (selection: Extract<SeriesSelection, { kind: "new" }>) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type CreateSeriesFormProps = {
  initialAuthors: AuthorSelection[];
  initialName: string;
  onCancel: () => void;
  onConfirm: (selection: Extract<SeriesSelection, { kind: "new" }>) => void;
};

type SeriesStatusValue = (typeof SERIES_STATUS_OPTIONS)[number];

export function CreateSeriesDialog({
  authorSelections,
  initialName,
  onConfirm,
  onOpenChange,
  open,
}: CreateSeriesDialogProps) {
  const t = useTranslations("books");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("series.create.title")}</DialogTitle>
          <DialogDescription>{t("series.create.description")}</DialogDescription>
        </DialogHeader>
        <CreateSeriesForm
          initialAuthors={authorSelections}
          initialName={initialName}
          key={initialName}
          onCancel={() => onOpenChange(false)}
          onConfirm={(selection) => {
            onConfirm(selection);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function CreateSeriesForm({
  initialAuthors,
  initialName,
  onCancel,
  onConfirm,
}: CreateSeriesFormProps) {
  const t = useTranslations("books");
  const [name, setName] = useState(initialName);
  const [authors, setAuthors] = useState<AuthorSelection[]>(initialAuthors);
  const [status, setStatus] = useState<SeriesStatusValue>("unknown");
  const [totalBooks, setTotalBooks] = useState<number | undefined>(undefined);
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [totalBooksError, setTotalBooksError] = useState<string | undefined>(undefined);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (totalBooks !== undefined && totalBooks < TOTAL_BOOKS_MIN) {
      setTotalBooksError(t("series.create.totalBooksInvalid"));
      return;
    }

    const trimmedDescription = description.trim();
    const parsed = NewSeriesInputSchema.safeParse({
      authors: authors.map(authorSelectionToReference),
      description: trimmedDescription.length > 0 ? trimmedDescription : undefined,
      name,
      status,
      totalBooks,
    });

    if (!parsed.success) {
      const nameIssue = parsed.error.issues.find((issue) => issue.path[0] === "name");
      const totalIssue = parsed.error.issues.find((issue) => issue.path[0] === "totalBooks");
      if (totalIssue) setTotalBooksError(totalIssue.message);
      if (nameIssue || !totalIssue) {
        setNameError(nameIssue?.message ?? t("series.create.nameInvalid"));
      }
      return;
    }

    onConfirm({ authors, draft: parsed.data, kind: "new", name: parsed.data.name });
  }

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-series-name">{t("series.create.name")}</Label>
        <Input
          aria-describedby={nameError ? "new-series-name-error" : undefined}
          aria-invalid={nameError !== undefined}
          autoComplete="off"
          className="h-10"
          id="new-series-name"
          isClearable
          maxLength={NAME_MAX}
          onChange={(event) => {
            setName(event.target.value);
            if (nameError) setNameError(undefined);
          }}
          onClear={() => {
            setName("");
            if (nameError) setNameError(undefined);
          }}
          placeholder={t("series.create.namePlaceholder")}
          value={name}
        />
        {nameError ? (
          <p className="text-xs text-destructive" id="new-series-name-error" role="alert">
            {nameError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="new-series-authors">
          {t("series.create.authors")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("fields.optional")}</span>
        </Label>
        <AuthorsField
          id="new-series-authors"
          invalid={false}
          onChange={setAuthors}
          value={authors}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("series.create.status")}</Label>
        <StatusChipGroup
          label={t("series.create.status")}
          onValueChange={(value) => setStatus(value as SeriesStatusValue)}
          options={SERIES_STATUS_OPTIONS.map((value) => ({
            label: t(`series.statusLabels.${value}`),
            value,
          }))}
          value={status}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="new-series-total-books">
          {t("series.create.totalBooks")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("fields.optional")}</span>
        </Label>
        <Input
          aria-describedby={totalBooksError ? "new-series-total-books-error" : undefined}
          aria-invalid={totalBooksError !== undefined}
          autoComplete="off"
          className="h-10 sm:w-40"
          id="new-series-total-books"
          inputMode="numeric"
          max={TOTAL_BOOKS_MAX}
          min={TOTAL_BOOKS_MIN}
          onChange={(event) => {
            setTotalBooks(emptyToInteger(event.target.value));
            if (totalBooksError) setTotalBooksError(undefined);
          }}
          onKeyDown={blockNegativeNumberKeys}
          onPaste={blockNegativeNumberPaste}
          placeholder={t("series.create.totalBooksPlaceholder")}
          step={1}
          type="number"
          value={totalBooks ?? ""}
        />
        {totalBooksError ? (
          <p className="text-xs text-destructive" id="new-series-total-books-error" role="alert">
            {totalBooksError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="new-series-description">
          {t("series.create.descriptionLabel")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("fields.optional")}</span>
        </Label>
        <Textarea
          aria-describedby="new-series-description-counter"
          id="new-series-description"
          maxLength={DESCRIPTION_MAX}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t("series.create.descriptionPlaceholder")}
          value={description}
        />
        <span
          className="ml-auto text-xs text-muted-foreground tabular-nums"
          id="new-series-description-counter"
        >
          {description.length}/{DESCRIPTION_MAX}
        </span>
      </div>

      <DialogFooter>
        <Button onClick={onCancel} type="button" variant="secondary">
          {t("actions.cancel")}
        </Button>
        <Button type="submit">{t("series.create.confirm")}</Button>
      </DialogFooter>
    </form>
  );
}

function emptyToInteger(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isInteger(parsed) ? parsed : undefined;
}
