"use client";

import type { BookFormat, BookView, OwnershipStatus, ReadingStatus } from "@app/shared";

import {
  BOOK_DESCRIPTION_MAX,
  BOOK_PART_NUMBER_EXCEEDS_TOTAL_MESSAGE,
  BOOK_SERIES_PART_NUMBER_TAKEN_CODE,
} from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Controller, type Path, type Resolver, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUploadMedia } from "@/features/media";
import { useRouter } from "@/i18n/navigation";
import { ApiError, type FieldError as ApiFieldError } from "@/lib/http-client";

import type { BookFormMode } from "../model/book-form-mode";

import { useCreateBook } from "../api/use-create-book";
import { useGenres } from "../api/use-genres";
import { useUpdateBook } from "../api/use-update-book";
import { readBookFormDraft } from "../model/book-form-draft";
import {
  FORMAT_OPTIONS,
  ownershipBlockHasData,
  pruneStatusPayload,
  readingProgressHasData,
} from "../model/book-status-fields";
import { bookViewToFormState } from "../model/book-view-to-form";
import { coverPreviewSrc, type CoverState } from "../model/cover-state";
import {
  type AuthorSelection,
  authorSelectionToReference,
  createBookFormDefaults,
  type CreateBookFormOutput,
  type CreateBookFormValues,
  CreateBookInputSchema,
  type PublisherSelection,
  type SeriesPartNumberConflict,
  type SeriesSelection,
  UpdateBookInputSchema,
} from "../model/create-book-form";
import { AuthorAutocomplete } from "./author-autocomplete";
import { BookPreview } from "./book-preview";
import { BookTypeSection } from "./book-type-section";
import { ClassificationSection } from "./classification-section";
import { CoverField } from "./cover-field";
import { DiscardConfirmDialog } from "./discard-confirm-dialog";
import { EditionDetailsSection } from "./edition-details-section";
import { FormSection } from "./form-section";
import { FormatSection } from "./format-section";
import { LibraryOrganizationSection } from "./library-organization-section";
import { OwnershipStatusSection } from "./ownership-status-section";
import { PublisherAutocomplete } from "./publisher-autocomplete";
import { ReadingStatusSection } from "./reading-status-section";

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

const SERVER_FIELD_PATHS = [
  "title",
  "author",
  "publisherName",
  "description",
  "partNumber",
] as const;

export function BookForm(props: BookFormProps) {
  const t = useTranslations("books");
  const router = useRouter();
  const mode: BookFormMode = props.mode;

  const bookId = props.mode === "edit" ? props.book.id : null;
  const initial = props.mode === "edit" ? bookViewToFormState(props.book) : null;

  const locale = useLocale();
  const draftKey = bookId === null ? "book-form-draft:create" : `book-form-draft:edit:${bookId}`;
  const [restoredDraft] = useState(() => readBookFormDraft(draftKey, locale));

  const createBook = useCreateBook();
  const updateBook = useUpdateBook(bookId ?? "");
  const uploadMedia = useUploadMedia();
  const genres = useGenres();
  const isPending = createBook.isPending || updateBook.isPending || uploadMedia.isPending;

  const initialCover = initial?.cover ?? null;

  const [authorSelection, setAuthorSelection] = useState<AuthorSelection | null>(
    restoredDraft?.authorSelection ?? initial?.authorSelection ?? null,
  );
  const [publisherSelection, setPublisherSelection] = useState<null | PublisherSelection>(
    restoredDraft?.publisherSelection ?? initial?.publisherSelection ?? null,
  );
  const [seriesSelection, setSeriesSelection] = useState<null | SeriesSelection>(
    restoredDraft?.seriesSelection ?? initial?.seriesSelection ?? null,
  );
  const [coverState, setCoverState] = useState<CoverState>(
    initialCover === null ? { kind: "empty" } : { kind: "existing", media: initialCover },
  );
  const [coverDirty, setCoverDirty] = useState(false);
  const [pendingDiscard, setPendingDiscard] = useState<null | PendingDiscard>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [uploadedCover, setUploadedCover] = useState<null | { file: File; mediaId: string }>(null);
  const [seriesConflict, setSeriesConflict] = useState<null | SeriesPartNumberConflict>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (coverState.kind !== "selected") return;
    const url = coverState.previewUrl;
    return () => URL.revokeObjectURL(url);
  }, [coverState]);

  function handleCoverChange(next: CoverState) {
    setCoverState(next);
    setCoverDirty(true);
  }

  const resolver = (
    props.mode === "edit" ? zodResolver(UpdateBookInputSchema) : zodResolver(CreateBookInputSchema)
  ) as Resolver<CreateBookFormValues, unknown, CreateBookFormOutput>;

  const {
    clearErrors,
    control,
    formState: { errors, isDirty },
    getValues,
    handleSubmit,
    register,
    setError,
    setValue,
    subscribe,
  } = useForm<CreateBookFormValues, unknown, CreateBookFormOutput>({
    defaultValues: restoredDraft
      ? { ...(initial?.values ?? createBookFormDefaults), ...restoredDraft.values }
      : (initial?.values ?? createBookFormDefaults),
    mode: "onTouched",
    resolver,
    reValidateMode: "onChange",
  });

  function clearDraft() {
    try {
      sessionStorage.removeItem(draftKey);
    } catch {
      return;
    }
  }

  useEffect(() => {
    function persist() {
      try {
        sessionStorage.setItem(
          draftKey,
          JSON.stringify({
            authorSelection,
            locale,
            publisherSelection,
            seriesSelection,
            values: getValues(),
          }),
        );
      } catch {
        return;
      }
    }
    persist();
    const unsubscribe = subscribe({ callback: persist, formState: { values: true } });
    return unsubscribe;
  }, [
    authorSelection,
    draftKey,
    getValues,
    locale,
    publisherSelection,
    seriesSelection,
    subscribe,
  ]);

  const titleValue = useWatch({ control, name: "title" }) ?? "";
  const descriptionValue = useWatch({ control, name: "description" }) ?? "";
  const readingStatusValue = useWatch({ control, name: "readingStatus" }) ?? "not_started";
  const ownershipStatusValue = useWatch({ control, name: "ownershipStatus" }) ?? "none";
  const genresValue = useWatch({ control, name: "genres" }) ?? [];
  const tagsValue = useWatch({ control, name: "tags" }) ?? [];
  const formatsValue = useWatch({ control, name: "formats" }) ?? [];
  const isFavoriteValue = useWatch({ control, name: "isFavorite" }) ?? false;
  const inQueueValue = useWatch({ control, name: "addToReadingQueue" }) ?? false;
  const ratingValue = useWatch({ control, name: "readingProgress.rating" });
  const partNumberValue = useWatch({ control, name: "partNumber" });

  function handleSeriesSelectionChange(selection: null | SeriesSelection) {
    setSeriesConflict(null);
    setSeriesSelection(selection);
  }

  useEffect(() => {
    if (seriesSelection?.kind !== "existing" || seriesSelection.totalBooks === undefined) return;
    if (typeof partNumberValue !== "number") return;
    if (partNumberValue > seriesSelection.totalBooks) {
      setError("partNumber", { message: BOOK_PART_NUMBER_EXCEEDS_TOTAL_MESSAGE });
    } else {
      clearErrors("partNumber");
    }
  }, [clearErrors, partNumberValue, seriesSelection, setError]);

  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));
  const previewGenres = genresValue.map((key) => genreNameByKey.get(key) ?? key);
  const previewTags = tagsValue.filter((value): value is string => typeof value === "string");
  const previewFormats = formatsValue.filter(isBookFormat);
  const previewRating = typeof ratingValue === "number" ? ratingValue : undefined;

  const previewAuthorName = authorSelection?.name ?? "";
  const previewPublisherName = publisherSelection?.name ?? "";
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

  function requestQueueRemoval(apply: () => void) {
    setPendingDiscard({
      apply,
      description: t("editConfirm.queue.description"),
      title: t("editConfirm.queue.title"),
    });
  }

  const onSubmit = handleSubmit(async (values) => {
    setSeriesConflict(null);
    if (
      seriesSelection?.kind === "existing" &&
      seriesSelection.totalBooks !== undefined &&
      typeof values.partNumber === "number" &&
      values.partNumber > seriesSelection.totalBooks
    ) {
      setError("partNumber", { message: BOOK_PART_NUMBER_EXCEEDS_TOTAL_MESSAGE });
      return;
    }

    const payload = pruneStatusPayload(values);

    if (coverState.kind === "selected") {
      try {
        if (uploadedCover !== null && uploadedCover.file === coverState.file) {
          payload.coverMediaId = uploadedCover.mediaId;
        } else {
          const media = await uploadMedia.mutateAsync({
            crop: coverState.crop,
            file: coverState.file,
          });
          setUploadedCover({ file: coverState.file, mediaId: media.id });
          payload.coverMediaId = media.id;
        }
      } catch {
        toast.error(t("cover.errors.upload"));
        return;
      }
    } else if (coverState.kind === "removed") {
      payload.coverMediaId = null;
    }

    if (props.mode === "edit") {
      updateBook.mutate(payload, {
        onError: (error) => handleMutationError(error),
        onSuccess: () => {
          clearDraft();
          toast.success(t("submit.editSuccess"));
          router.push("/books");
        },
      });
      return;
    }
    createBook.mutate(payload, {
      onError: (error) => handleMutationError(error),
      onSuccess: () => {
        sessionStorage.removeItem(draftKey);
        toast.success(t("submit.success"));
        router.push("/books");
      },
    });
  });

  function handleMutationError(error: unknown) {
    if (error instanceof ApiError && error.fieldErrors) {
      for (const fieldError of error.fieldErrors) {
        const conflict = toSeriesPartNumberConflict(fieldError);
        if (conflict) {
          setSeriesConflict(conflict);
          continue;
        }
        const path = resolveFieldPath(fieldError.field);
        if (path) setError(path, { message: fieldError.message });
      }
    }
    toast.error(mode === "edit" ? t("submit.editError") : t("submit.error"));
  }

  const descriptionRemaining = BOOK_DESCRIPTION_MAX - descriptionValue.length;
  const cancelHref = bookId === null ? "/" : "/books";
  const formDirty = isDirty || coverDirty;
  const guardActive = formDirty && !isPending;

  useEffect(() => {
    if (!guardActive) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [guardActive]);

  useEffect(() => {
    const form = formRef.current;
    if (form === null) return;
    function blockImplicitSubmit(event: KeyboardEvent) {
      if (event.isComposing) return;
      if (event.key !== "Enter" || event.defaultPrevented) return;
      if (event.target instanceof HTMLInputElement) event.preventDefault();
    }
    form.addEventListener("keydown", blockImplicitSubmit);
    return () => form.removeEventListener("keydown", blockImplicitSubmit);
  }, []);

  function navigateAway() {
    router.push(cancelHref);
  }

  function handleCancel() {
    if (formDirty) {
      setCancelConfirmOpen(true);
      return;
    }
    navigateAway();
  }

  return (
    <form
      className="grid gap-6 pb-24 sm:pb-0 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"
      noValidate
      onSubmit={onSubmit}
      ref={formRef}
    >
      <div className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:slide-in-from-bottom-2">
        <FormSection
          description={t("basicInfo.description")}
          icon="book"
          title={t("basicInfo.title")}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="book-title">{t("fields.title")}</Label>
              <span aria-hidden className="text-destructive">
                *
              </span>
            </div>
            <Input
              aria-describedby={errors.title ? "book-title-error" : undefined}
              aria-invalid={errors.title !== undefined}
              aria-required="true"
              autoComplete="off"
              className="h-10"
              id="book-title"
              placeholder={t("fields.titlePlaceholder")}
              {...register("title")}
            />
            <FieldError error={errors.title} id="book-title-error" />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="book-author">{t("fields.author")}</Label>
              <span aria-hidden className="text-destructive">
                *
              </span>
            </div>
            <Controller
              control={control}
              name="author"
              render={({ field }) => (
                <AuthorAutocomplete
                  describedBy={errors.author ? "book-author-error" : undefined}
                  id="book-author"
                  invalid={errors.author !== undefined}
                  label={t("fields.author")}
                  onChange={(selection: AuthorSelection | null) => {
                    setAuthorSelection(selection);
                    field.onChange(
                      selection === null ? { name: "" } : authorSelectionToReference(selection),
                    );
                  }}
                  placeholder={t("fields.authorPlaceholder")}
                  required
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
              {t("fields.publisher")}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                {t("fields.optional")}
              </span>
            </Label>
            <PublisherAutocomplete
              describedBy={errors.publisherName ? "book-publisher-error" : undefined}
              id="book-publisher"
              invalid={errors.publisherName !== undefined}
              label={t("fields.publisher")}
              onChange={(selection: null | PublisherSelection) => {
                setPublisherSelection(selection);
                if (selection === null) {
                  setValue("publisherId", undefined, { shouldDirty: true, shouldValidate: true });
                  setValue("publisherName", undefined, { shouldDirty: true, shouldValidate: true });
                  return;
                }
                if (selection.kind === "catalog") {
                  setValue("publisherName", undefined, { shouldDirty: true, shouldValidate: true });
                  setValue("publisherId", selection.id, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  return;
                }
                setValue("publisherId", undefined, { shouldDirty: true, shouldValidate: true });
                setValue("publisherName", selection.name, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
              placeholder={t("fields.publisherPlaceholder")}
              value={publisherSelection}
            />
            <p className="text-xs text-muted-foreground">{t("fields.publisherHint")}</p>
            <FieldError error={errors.publisherName} id="book-publisher-error" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="book-description">
              {t("fields.description")}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                {t("fields.optional")}
              </span>
            </Label>
            <Textarea
              aria-describedby="book-description-counter"
              aria-invalid={errors.description !== undefined}
              id="book-description"
              maxLength={BOOK_DESCRIPTION_MAX}
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
                {descriptionValue.length}/{BOOK_DESCRIPTION_MAX}
              </span>
            </div>
          </div>
        </FormSection>

        <ClassificationSection control={control} errors={errors} />

        <BookTypeSection
          control={control}
          errors={errors}
          onRequestSoloChange={mode === "edit" ? requestSoloChange : undefined}
          onSeriesSelectionChange={handleSeriesSelectionChange}
          seriesConflict={seriesConflict}
          seriesSelection={seriesSelection}
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
          setValue={setValue}
        />

        <FormatSection control={control} />

        <EditionDetailsSection control={control} errors={errors} register={register} />

        <LibraryOrganizationSection
          control={control}
          errors={errors}
          onRequestQueueRemoval={
            mode === "edit" && initial?.values.addToReadingQueue === true
              ? requestQueueRemoval
              : undefined
          }
          setValue={setValue}
        />

        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 bg-background/80 px-5 pt-3 safe-bottom backdrop-blur-xl backdrop-saturate-150 sm:sticky sm:inset-x-auto sm:z-10 sm:-mx-1 sm:justify-end sm:rounded-t-xl sm:px-4 sm:py-3">
          <Button
            className="h-11 flex-1 sm:h-10 sm:flex-none"
            disabled={isPending}
            onClick={handleCancel}
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

      <div className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:slide-in-from-bottom-2 lg:sticky lg:top-[calc(var(--shell-header-height)+theme(spacing.4))]">
        <CoverField
          disabled={isPending}
          hadInitialCover={initialCover !== null}
          onChange={handleCoverChange}
          state={coverState}
        />
        <BookPreview
          authorName={previewAuthorName}
          coverSrc={coverPreviewSrc(coverState)}
          description={descriptionValue}
          formats={previewFormats}
          genres={previewGenres}
          inQueue={inQueueValue}
          isFavorite={isFavoriteValue}
          ownershipStatus={ownershipStatusValue}
          publisherName={previewPublisherName}
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

      <DiscardConfirmDialog
        description={t("cancelConfirm.description")}
        onConfirm={() => {
          setCancelConfirmOpen(false);
          navigateAway();
        }}
        onOpenChange={setCancelConfirmOpen}
        open={cancelConfirmOpen}
        title={t("cancelConfirm.title")}
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

function toSeriesPartNumberConflict(fieldError: ApiFieldError): null | SeriesPartNumberConflict {
  if (fieldError.code !== BOOK_SERIES_PART_NUMBER_TAKEN_CODE) return null;
  const meta = fieldError.meta;
  if (!meta) return null;
  const { bookId, bookTitle, partNumber } = meta;
  if (!bookId || !bookTitle || !partNumber) return null;
  const parsed = Number(partNumber);
  if (!Number.isFinite(parsed)) return null;
  return { bookId, bookTitle, partNumber: parsed };
}
