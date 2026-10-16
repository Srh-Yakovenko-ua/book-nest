"use client";

import type { BookCharacterView, CharacterDetailsView, MediaView, Nullable } from "@app/shared";

import { CHARACTER_INT4_MAX, CHARACTER_TEXT_MAX } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DiscardConfirmDialog } from "@/features/books";
import { useBookPagesCount } from "@/features/books/api/use-book";
import { bookPageCeiling } from "@/features/books/model/book-page-ceiling";
import { type OwnSpeciesChange, useSpeciesLocale } from "@/features/species";
import { useRouter } from "@/i18n/navigation";
import { applyFieldErrors } from "@/lib/api-errors";

import type { CharacterEditMessages, CharacterEditValues } from "../model/character-edit-form";
import type { CharacterImageUpload } from "./character-image-field";

import { useCharacterDetails } from "../api/use-character-details";
import { useUpdateBookCharacter } from "../api/use-update-book-character";
import { useUpdateCharacter } from "../api/use-update-character";
import {
  type CharacterDetailsMode,
  characterRouteArgsOf,
  isUnavailableContextError,
  resolveCharacterDetailsRequest,
} from "../model/character-details-context";
import {
  buildCharacterEditSchema,
  isScopeDirty,
  maskedEditFields,
  toBookPatch,
  toCharacterEditValues,
  toGlobalUpdate,
  withSpeciesChange,
} from "../model/character-edit-form";
import { getCharacterDetailsPath } from "../model/character-routes";
import { ALL_REVEAL_FIELD_KEYS } from "../model/character-spoiler";
import { CharacterEditPreview } from "./character-edit-preview";
import {
  BookCharacterDescriptionsSection,
  BookCharacterNarrativeSection,
  BookCharacterSpoilerSection,
  CharacterAliasesSection,
  CharacterAttitudeSection,
  CharacterBasicsSection,
} from "./character-edit-sections";
import { CharacterPortraitPanel } from "./character-portrait-panel";
import { CharacterUnavailableContext } from "./character-unavailable-context";
import { CharactersErrorState } from "./characters-error-state";

type CharacterEditPageProps = {
  characterId: string;
};

export function CharacterEditPage({ characterId }: CharacterEditPageProps) {
  const [bookId] = useQueryState("bookId", parseAsString);
  const [view] = useQueryState("view", parseAsString);
  const request = resolveCharacterDetailsRequest({ bookId, view });
  const details = useCharacterDetails({
    characterId,
    enabled: request.kind !== "invalid-book",
    revealFieldIds: ALL_REVEAL_FIELD_KEYS,
    ...(request.kind === "book" ? { contextBookId: request.bookId } : {}),
  });

  if (request.kind === "invalid-book") {
    return <CharacterUnavailableContext characterId={characterId} />;
  }

  if (details.isPending) return <EditSkeleton />;

  if (details.isError) {
    if (request.kind === "book" && isUnavailableContextError(details.error)) {
      return <CharacterUnavailableContext characterId={characterId} />;
    }
    return (
      <div role="alert">
        <CharactersErrorState onRetry={() => void details.refetch()} />
      </div>
    );
  }

  const appearance =
    request.kind === "book"
      ? details.data.appearances.find((entry) => entry.bookId === request.bookId)
      : undefined;

  if (request.kind === "book" && appearance === undefined) {
    return <CharacterUnavailableContext characterId={characterId} />;
  }

  return (
    <CharacterEditForm
      appearance={appearance}
      character={details.data}
      contextBookId={appearance?.bookId ?? null}
      key={characterId}
      mode={request}
    />
  );
}

function CharacterEditForm({
  appearance,
  character,
  contextBookId,
  mode,
}: {
  appearance: BookCharacterView | undefined;
  character: CharacterDetailsView;
  contextBookId: null | string;
  mode: CharacterDetailsMode;
}) {
  const t = useTranslations("characters.edit");
  const tAliases = useTranslations("characters.aliases");
  const tErrors = useTranslations("characters.form.errors");
  const tToast = useTranslations("characters.toast");
  const tDiscardChanges = useTranslations("common.discardChanges");
  const router = useRouter();
  const updateCharacter = useUpdateCharacter();
  const updateBookCharacter = useUpdateBookCharacter();

  const locale = useSpeciesLocale();
  const initialValues = toCharacterEditValues({
    bookId: contextBookId ?? undefined,
    character,
    locale,
  });
  const [baseline, setBaseline] = useState<CharacterEditValues>(initialValues);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<Record<string, string>>({});

  const pagesCount = useBookPagesCount(contextBookId);
  const pageCeiling = bookPageCeiling({ pagesCount, technicalMax: CHARACTER_INT4_MAX });
  const messages: CharacterEditMessages = {
    aliasDuplicate: tAliases("errorDuplicate"),
    aliasReservedBook: tAliases("errorSameAsDisplayName"),
    aliasReservedGlobal: tAliases("errorSameAsName"),
    customGenderRequired: tErrors("customGenderRequired"),
    firstAppearancePageExceedsBook: t("firstAppearancePageExceedsBook", { max: pageCeiling.max }),
    firstAppearancePageInvalid: t("firstAppearancePageInvalid"),
    nameRequired: tErrors("nameRequired"),
    nameTooLong: tErrors("nameTooLong", { max: CHARACTER_TEXT_MAX.name }),
    textTooLong: (max) => tErrors("textTooLong", { max }),
  };

  const form = useForm<CharacterEditValues>({
    defaultValues: initialValues,
    mode: "onTouched",
    resolver: (values, context, options) =>
      zodResolver(buildCharacterEditSchema(messages, pageCeiling))(values, context, options),
  });

  const {
    control,
    formState: { errors },
    getFieldState,
    getValues,
    handleSubmit,
    register,
    setValue,
    trigger,
  } = form;

  useEffect(() => {
    if (
      !getFieldState("book.firstAppearancePage").isTouched &&
      getValues("book.firstAppearancePage") === null
    ) {
      return;
    }
    void trigger("book.firstAppearancePage");
  }, [getFieldState, getValues, pageCeiling.max, trigger]);

  const current = useWatch({ control });
  const currentValues = current as CharacterEditValues;
  const maskedFields = maskedEditFields({ appearance, character });
  const globalDirty = isScopeDirty({
    baseline,
    current: currentValues,
    maskedFields,
    scope: "global",
  });
  const bookDirty =
    contextBookId !== null &&
    isScopeDirty({ baseline, current: currentValues, maskedFields, scope: "book" });
  const isDirty = globalDirty || bookDirty;
  const isSaving = updateCharacter.isPending || updateBookCharacter.isPending;
  const avatarMediaId = useWatch({ control, name: "global.avatarMediaId" });
  const portraitMediaId = useWatch({ control, name: "book.portraitMediaId" });
  const avatarUrl = resolveImageUrl({
    mediaId: avatarMediaId,
    saved: character.avatar,
    uploadedUrls: uploadedImageUrls,
  });
  const portraitUrl = resolveImageUrl({
    mediaId: portraitMediaId,
    saved: appearance?.portrait ?? null,
    uploadedUrls: uploadedImageUrls,
  });
  const previewImageUrl = portraitMediaId === null ? avatarUrl : portraitUrl;

  const detailsHref = getCharacterDetailsPath(
    characterRouteArgsOf({ characterId: character.id, mode }),
  );

  function rememberUploadedImage(upload: CharacterImageUpload) {
    setUploadedImageUrls((previous) => ({ ...previous, [upload.mediaId]: upload.previewUrl }));
  }

  function applySpeciesChange(change: OwnSpeciesChange) {
    const next = withSpeciesChange(getValues(), change);
    setValue("global.species", next.global.species);
    setValue("book.speciesOverride", next.book.speciesOverride);
    setValue("book.speciesOverrideIsSpoiler", next.book.speciesOverrideIsSpoiler);
    setBaseline((previous) => withSpeciesChange(previous, change));
  }

  function leave() {
    router.push(detailsHref);
  }

  function cancel() {
    if (!isDirty) {
      leave();
      return;
    }
    setDiscardOpen(true);
  }

  const onSubmit = handleSubmit(async (values) => {
    let savedGlobal = false;

    try {
      if (globalDirty) {
        await updateCharacter.mutateAsync({
          characterId: character.id,
          input: toGlobalUpdate(values.global, maskedFields),
        });
        setBaseline((previous) => ({ ...previous, global: values.global }));
        savedGlobal = true;
      }

      if (bookDirty && contextBookId !== null) {
        await updateBookCharacter.mutateAsync({
          bookId: contextBookId,
          characterId: character.id,
          input: toBookPatch({ baseline: baseline.book, current: values.book, maskedFields }),
        });
        setBaseline((previous) => ({ ...previous, book: values.book }));
      }

      toast.success(tToast("updated"));
      leave();
    } catch (error) {
      if (savedGlobal) toast.warning(t("partialSuccess"));
      if (!applyFieldErrors(form, error)) toast.error(tErrors("generic"));
    }
  });

  return (
    <form
      className="grid grid-cols-[minmax(0,1fr)] gap-6 pb-24 sm:pb-0 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"
      noValidate
      onSubmit={onSubmit}
    >
      <div className="contents lg:sticky lg:top-[calc(var(--shell-header-height)+theme(spacing.4))] lg:col-start-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-6">
        <div className="motion-safe:animate-in motion-safe:duration-500 motion-safe:slide-in-from-bottom-2">
          <CharacterPortraitPanel
            avatarUrl={avatarUrl}
            control={control}
            hasBookScope={contextBookId !== null}
            maskedFields={maskedFields}
            onImageUpload={rememberUploadedImage}
            portraitUrl={portraitUrl}
          />
        </div>

        <div className="order-last motion-safe:animate-in motion-safe:duration-500 motion-safe:slide-in-from-bottom-2 lg:order-none">
          <CharacterEditPreview control={control} imageUrl={previewImageUrl} />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:slide-in-from-bottom-2 lg:col-start-1 lg:row-start-1">
        <CharacterBasicsSection
          control={control}
          errors={errors}
          hasBookScope={contextBookId !== null}
          maskedFields={maskedFields}
          onSpeciesChange={applySpeciesChange}
          register={register}
        />

        {contextBookId === null ? null : (
          <BookCharacterDescriptionsSection control={control} errors={errors} register={register} />
        )}

        {contextBookId === null ? null : (
          <BookCharacterNarrativeSection
            bookId={contextBookId}
            control={control}
            errors={errors}
            maskedFields={maskedFields}
            pageMax={pageCeiling.max}
            register={register}
          />
        )}

        <CharacterAttitudeSection
          control={control}
          errors={errors}
          hasBookScope={contextBookId !== null}
          register={register}
        />

        <CharacterAliasesSection
          control={control}
          errors={errors}
          hasBookScope={contextBookId !== null}
        />

        {contextBookId === null ? null : <BookCharacterSpoilerSection control={control} />}

        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 bg-background/80 px-5 pt-3 safe-bottom backdrop-blur-xl backdrop-saturate-150 sm:sticky sm:inset-x-auto sm:z-10 sm:-mx-1 sm:justify-end sm:rounded-t-xl sm:px-4 sm:py-3">
          <Button
            className="h-11 flex-1 sm:h-10 sm:flex-none"
            disabled={isSaving}
            onClick={cancel}
            type="button"
            variant="secondary"
          >
            {t("cancel")}
          </Button>
          <Button
            className="h-11 flex-1 sm:h-10 sm:flex-none"
            disabled={isSaving || !isDirty}
            loading={isSaving}
            type="submit"
          >
            <UiIcon name="check" size={16} />
            {t("save")}
          </Button>
        </div>
      </div>

      <DiscardConfirmDialog
        cancelLabel={tDiscardChanges("cancel")}
        confirmLabel={tDiscardChanges("confirm")}
        description={t("discardDescription")}
        onConfirm={leave}
        onOpenChange={setDiscardOpen}
        open={discardOpen}
        title={t("discardTitle")}
      />
    </form>
  );
}

function EditSkeleton() {
  const t = useTranslations("common");

  return (
    <output
      aria-busy="true"
      aria-label={t("loading")}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"
    >
      <div className="flex flex-col gap-6">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
      <div className="flex flex-col gap-6">
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </output>
  );
}

function resolveImageUrl({
  mediaId,
  saved,
  uploadedUrls,
}: {
  mediaId: Nullable<string>;
  saved: Nullable<MediaView>;
  uploadedUrls: Record<string, string>;
}): Nullable<string> {
  if (mediaId === null) return null;
  if (saved?.id === mediaId) return saved.urls.card;
  return uploadedUrls[mediaId] ?? null;
}
