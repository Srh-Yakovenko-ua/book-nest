"use client";

import type { BookFormat, BookView, OwnershipStatus, ReadingStatus } from "@app/shared";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, type Path, type Resolver, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/http-client";

import type { BookFormMode } from "../model/book-form-mode";

import { useCreateBook } from "../api/use-create-book";
import { useUpdateBook } from "../api/use-update-book";
import { isBookGenre } from "../model/book-classification-fields";
import {
  FORMAT_OPTIONS,
  ownershipBlockHasData,
  pruneStatusPayload,
  readingProgressHasData,
} from "../model/book-status-fields";
import { bookViewToFormState } from "../model/book-view-to-form";
import {
  type AuthorSelection,
  authorSelectionToReference,
  createBookFormDefaults,
  type CreateBookFormOutput,
  type CreateBookFormValues,
  CreateBookInputSchema,
  UpdateBookInputSchema,
} from "../model/create-book-form";
import { AuthorAutocomplete } from "./author-autocomplete";
import { BookPreview } from "./book-preview";
import { BookTypeSection } from "./book-type-section";
import { ClassificationSection } from "./classification-section";
import { DiscardConfirmDialog } from "./discard-confirm-dialog";
import { EditionDetailsSection } from "./edition-details-section";
import { FormSection } from "./form-section";
import { FormatSection } from "./format-section";
import { LibraryOrganizationSection } from "./library-organization-section";
import { OwnershipStatusSection } from "./ownership-status-section";
import { ReadingStatusSection } from "./reading-status-section";

const DESCRIPTION_MAX = 500;

type BookFormProps = { book: BookView; mode: "edit" } | { mode: "create" };

type PendingDiscard = {
  apply: () => void;
  description: string;
  title: string;
};

function emptyToUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const SERVER_FIELD_PATHS = ["title", "author", "publisherName", "description"] as const;

export function BookForm(props: BookFormProps) {
  const t = useTranslations("books");
  const router = useRouter();
  const mode: BookFormMode = props.mode;

  const bookId = props.mode === "edit" ? props.book.id : null;
  const initial = props.mode === "edit" ? bookViewToFormState(props.book) : null;

  const createBook = useCreateBook();
  const updateBook = useUpdateBook(bookId ?? "");
  const isPending = createBook.isPending || updateBook.isPending;

  const [authorSelection, setAuthorSelection] = useState<AuthorSelection | null>(
    initial?.authorSelection ?? null,
  );
  const [pendingDiscard, setPendingDiscard] = useState<null | PendingDiscard>(null);

  const resolver = (
    props.mode === "edit" ? zodResolver(UpdateBookInputSchema) : zodResolver(CreateBookInputSchema)
  ) as Resolver<CreateBookFormValues, unknown, CreateBookFormOutput>;

  const {
    control,
    formState: { errors },
    getValues,
    handleSubmit,
    register,
    setError,
    setValue,
  } = useForm<CreateBookFormValues, unknown, CreateBookFormOutput>({
    defaultValues: initial?.values ?? createBookFormDefaults,
    mode: "onTouched",
    resolver,
    reValidateMode: "onChange",
  });

  const titleValue = useWatch({ control, defaultValue: "", name: "title" }) ?? "";
  const publisherValue = useWatch({ control, defaultValue: "", name: "publisherName" }) ?? "";
  const descriptionValue = useWatch({ control, defaultValue: "", name: "description" }) ?? "";
  const readingStatusValue =
    useWatch({ control, defaultValue: "not_started", name: "readingStatus" }) ?? "not_started";
  const ownershipStatusValue =
    useWatch({ control, defaultValue: "none", name: "ownershipStatus" }) ?? "none";
  const genresValue = useWatch({ control, defaultValue: [], name: "genres" }) ?? [];
  const tagsValue = useWatch({ control, defaultValue: [], name: "tags" }) ?? [];
  const formatsValue = useWatch({ control, defaultValue: [], name: "formats" }) ?? [];
  const isFavoriteValue = useWatch({ control, defaultValue: false, name: "isFavorite" }) ?? false;
  const inQueueValue =
    useWatch({ control, defaultValue: false, name: "addToReadingQueue" }) ?? false;
  const ratingValue = useWatch({
    control,
    defaultValue: undefined,
    name: "readingProgress.rating",
  });

  const previewGenres = genresValue.filter(isBookGenre);
  const previewTags = tagsValue.filter((value): value is string => typeof value === "string");
  const previewFormats = formatsValue.filter(isBookFormat);
  const previewRating = typeof ratingValue === "number" ? ratingValue : undefined;

  const previewAuthorName = authorSelection?.name ?? "";
  const authorError = errors.author;
  const authorErrorMessage =
    typeof authorError?.message === "string" ? authorError.message : undefined;

  function requestReadingStatusChange(_next: ReadingStatus, apply: () => void) {
    const values = getValues();
    const hasData = readingProgressHasData(
      values.readingStatus ?? "not_started",
      values.readingProgress,
    );
    if (!hasData) {
      apply();
      return;
    }
    setPendingDiscard({
      apply: () => {
        setValue("readingProgress", {}, { shouldValidate: true });
        apply();
      },
      description: t("editConfirm.readingStatus.description"),
      title: t("editConfirm.readingStatus.title"),
    });
  }

  function requestOwnershipStatusChange(_next: OwnershipStatus, apply: () => void) {
    const values = getValues();
    const ownershipStatus = values.ownershipStatus ?? "none";
    const hasData =
      ownershipBlockHasData(ownershipStatus, values.purchaseInfo) ||
      ownershipBlockHasData(ownershipStatus, values.deliveryInfo) ||
      ownershipBlockHasData(ownershipStatus, values.loanInfo);
    if (!hasData) {
      apply();
      return;
    }
    setPendingDiscard({
      apply: () => {
        setValue("purchaseInfo", {}, { shouldValidate: true });
        setValue("deliveryInfo", {}, { shouldValidate: true });
        setValue("loanInfo", {}, { shouldValidate: true });
        apply();
      },
      description: t("editConfirm.ownershipStatus.description"),
      title: t("editConfirm.ownershipStatus.title"),
    });
  }

  function requestSoloChange(apply: () => void) {
    setPendingDiscard({
      apply,
      description: t("editConfirm.series.description"),
      title: t("editConfirm.series.title"),
    });
  }

  const onSubmit = handleSubmit((values) => {
    const payload = pruneStatusPayload(values);
    if (props.mode === "edit") {
      updateBook.mutate(payload, {
        onError: (error) => handleMutationError(error),
        onSuccess: () => {
          toast.success(t("submit.editSuccess"));
          router.push(`/books/${props.book.id}/edit`);
        },
      });
      return;
    }
    createBook.mutate(payload, {
      onError: (error) => handleMutationError(error),
      onSuccess: (created) => {
        toast.success(t("submit.success"));
        router.push(`/books/${created.id}/edit`);
      },
    });
  });

  function handleMutationError(error: unknown) {
    if (error instanceof ApiError && error.fieldErrors) {
      for (const fieldError of error.fieldErrors) {
        const path = resolveFieldPath(fieldError.field);
        if (path) setError(path, { message: fieldError.message });
      }
    }
    toast.error(mode === "edit" ? t("submit.editError") : t("submit.error"));
  }

  const descriptionRemaining = DESCRIPTION_MAX - descriptionValue.length;

  return (
    <form
      className="grid gap-6 pb-24 sm:pb-0 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"
      noValidate
      onSubmit={onSubmit}
    >
      <div className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:slide-in-from-bottom-2">
        <FormSection
          description={t("basicInfo.description")}
          icon="book"
          title={t("basicInfo.title")}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="book-title">{t("fields.title")}</Label>
            <Input
              aria-describedby={errors.title ? "book-title-error" : undefined}
              aria-invalid={errors.title !== undefined}
              autoComplete="off"
              className="h-10"
              id="book-title"
              placeholder={t("fields.titlePlaceholder")}
              {...register("title")}
            />
            <FieldError error={errors.title} id="book-title-error" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="book-author">{t("fields.author")}</Label>
            <Controller
              control={control}
              name="author"
              render={({ field }) => (
                <AuthorAutocomplete
                  describedBy={errors.author ? "book-author-error" : undefined}
                  id="book-author"
                  invalid={errors.author !== undefined}
                  onChange={(selection: AuthorSelection | null) => {
                    setAuthorSelection(selection);
                    field.onChange(
                      selection === null ? { name: "" } : authorSelectionToReference(selection),
                    );
                  }}
                  placeholder={t("fields.authorPlaceholder")}
                  value={authorSelection}
                />
              )}
            />
            <p className="text-xs text-muted-foreground">{t("fields.authorHint")}</p>
            {authorErrorMessage === undefined ? null : (
              <p className="text-xs text-destructive" id="book-author-error" role="alert">
                {authorErrorMessage}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="book-publisher">
              {t("fields.publisher")}
              <span className="text-xs font-normal text-muted-foreground">
                {t("fields.optional")}
              </span>
            </Label>
            <Input
              aria-invalid={errors.publisherName !== undefined}
              autoComplete="off"
              className="h-10"
              id="book-publisher"
              placeholder={t("fields.publisherPlaceholder")}
              {...register("publisherName", { setValueAs: emptyToUndefined })}
            />
            <FieldError error={errors.publisherName} id="book-publisher-error" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="book-description">
              {t("fields.description")}
              <span className="text-xs font-normal text-muted-foreground">
                {t("fields.optional")}
              </span>
            </Label>
            <Textarea
              aria-describedby="book-description-counter"
              aria-invalid={errors.description !== undefined}
              id="book-description"
              maxLength={DESCRIPTION_MAX}
              placeholder={t("fields.descriptionPlaceholder")}
              {...register("description", { setValueAs: emptyToUndefined })}
            />
            <div className="flex items-center justify-between gap-2">
              <FieldError error={errors.description} id="book-description-error" />
              <span
                className="ml-auto text-xs text-muted-foreground tabular-nums data-[low=true]:text-destructive"
                data-low={descriptionRemaining < 0}
                id="book-description-counter"
              >
                {descriptionValue.length}/{DESCRIPTION_MAX}
              </span>
            </div>
          </div>
        </FormSection>

        <ClassificationSection control={control} errors={errors} />

        <BookTypeSection
          control={control}
          errors={errors}
          initialSeries={initial?.seriesSelection ?? null}
          onRequestSoloChange={mode === "edit" ? requestSoloChange : undefined}
          setValue={setValue}
        />

        <ReadingStatusSection
          control={control}
          errors={errors}
          onRequestChange={mode === "edit" ? requestReadingStatusChange : undefined}
        />

        <OwnershipStatusSection
          control={control}
          errors={errors}
          mode={mode}
          onRequestChange={mode === "edit" ? requestOwnershipStatusChange : undefined}
          register={register}
        />

        <FormatSection control={control} />

        <EditionDetailsSection control={control} errors={errors} register={register} />

        <LibraryOrganizationSection
          control={control}
          errors={errors}
          mode={mode}
          setValue={setValue}
        />

        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-border bg-background/80 px-5 pt-3 safe-bottom backdrop-blur-xl backdrop-saturate-150 sm:static sm:z-auto sm:justify-end sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:pb-0 sm:backdrop-blur-none">
          <Button
            className="h-11 flex-1 sm:h-10 sm:flex-none"
            disabled={isPending}
            onClick={() => router.push(bookId === null ? "/" : `/books/${bookId}/edit`)}
            type="button"
            variant="secondary"
          >
            {t("actions.cancel")}
          </Button>
          <Button
            className="h-11 flex-1 sm:h-10 sm:flex-none"
            disabled={isPending}
            loading={isPending}
            type="submit"
          >
            <UiIcon name={mode === "edit" ? "check" : "plus"} size={16} />
            {submitLabel({ isPending, mode, t })}
          </Button>
        </div>
      </div>

      <div className="motion-safe:animate-in motion-safe:duration-500 motion-safe:slide-in-from-bottom-2 lg:sticky lg:top-6">
        <BookPreview
          authorName={previewAuthorName}
          description={descriptionValue}
          formats={previewFormats}
          genres={previewGenres}
          inQueue={inQueueValue}
          isFavorite={isFavoriteValue}
          ownershipStatus={ownershipStatusValue}
          publisherName={publisherValue}
          rating={previewRating}
          readingStatus={readingStatusValue}
          tags={previewTags}
          title={titleValue}
        />
      </div>

      <DiscardConfirmDialog
        description={pendingDiscard?.description ?? ""}
        onConfirm={() => {
          pendingDiscard?.apply();
          setPendingDiscard(null);
        }}
        onOpenChange={(open) => {
          if (!open) setPendingDiscard(null);
        }}
        open={pendingDiscard !== null}
        title={pendingDiscard?.title ?? ""}
      />
    </form>
  );
}

function isBookFormat(value: unknown): value is BookFormat {
  return typeof value === "string" && (FORMAT_OPTIONS as readonly string[]).includes(value);
}

function resolveFieldPath(field: string): null | Path<CreateBookFormValues> {
  const match = SERVER_FIELD_PATHS.find((path) => field === path || field.startsWith(`${path}.`));
  return match ?? null;
}

function submitLabel({
  isPending,
  mode,
  t,
}: {
  isPending: boolean;
  mode: BookFormMode;
  t: ReturnType<typeof useTranslations<"books">>;
}): string {
  if (mode === "edit") return isPending ? t("actions.saving") : t("actions.save");
  return isPending ? t("actions.submitting") : t("actions.submit");
}
