"use client";

import type { BookCharacterView, CharacterDetailsView, Nullable } from "@app/shared";

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
import { useRouter } from "@/i18n/navigation";
import { applyFieldErrors } from "@/lib/api-errors";

import type { CharacterEditMessages, CharacterEditValues } from "../model/character-edit-form";
import type { CharacterImageUpload } from "./character-image-field";

import { useCharacterDetails } from "../api/use-character-details";
import { useUpdateBookCharacter } from "../api/use-update-book-character";
import { useUpdateCharacter } from "../api/use-update-character";
import {
  buildCharacterEditSchema,
  isScopeDirty,
  maskedEditFields,
  toBookUpdate,
  toCharacterEditValues,
  toGlobalUpdate,
} from "../model/character-edit-form";
import { getCharacterDetailsPath } from "../model/character-routes";
import { ALL_REVEAL_FIELD_KEYS } from "../model/character-spoiler";
import { CharacterEditPreview } from "./character-edit-preview";
import {
  BookCharacterInheritanceSection,
  BookCharacterMainSection,
  BookCharacterNarrativeSection,
  BookCharacterSpoilerSection,
  CharacterAliasesSection,
  CharacterGlobalSection,
} from "./character-edit-sections";
import { CharacterPortraitPanel } from "./character-portrait-panel";
import { CharactersErrorState } from "./characters-error-state";

type CharacterEditPageProps = {
  characterId: string;
};

export function CharacterEditPage({ characterId }: CharacterEditPageProps) {
  const [bookId] = useQueryState("bookId", parseAsString);
  const details = useCharacterDetails({
    characterId,
    includeHiddenProfiles: true,
    revealFieldIds: ALL_REVEAL_FIELD_KEYS,
    ...(bookId === null ? {} : { contextBookId: bookId }),
  });

  if (details.isPending) return <EditSkeleton />;

  if (details.isError) {
    return (
      <div role="alert">
        <CharactersErrorState onRetry={() => void details.refetch()} />
      </div>
    );
  }

  const appearance =
    bookId === null ? undefined : details.data.appearances.find((entry) => entry.bookId === bookId);

  return (
    <CharacterEditForm
      appearance={appearance}
      character={details.data}
      contextBookId={appearance === undefined ? null : bookId}
      key={characterId}
    />
  );
}

function CharacterEditForm({
  appearance,
  character,
  contextBookId,
}: {
  appearance: BookCharacterView | undefined;
  character: CharacterDetailsView;
  contextBookId: null | string;
}) {
  const t = useTranslations("characters.edit");
  const tAliases = useTranslations("characters.aliases");
  const tErrors = useTranslations("characters.form.errors");
  const tToast = useTranslations("characters.toast");
  const tDiscardChanges = useTranslations("common.discardChanges");
  const router = useRouter();
  const updateCharacter = useUpdateCharacter();
  const updateBookCharacter = useUpdateBookCharacter();

  const initialValues = toCharacterEditValues(character, contextBookId ?? undefined);
  const [baseline, setBaseline] = useState<CharacterEditValues>(initialValues);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [uploadedPortrait, setUploadedPortrait] = useState<Nullable<CharacterImageUpload>>(null);

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
  const currentPortraitMediaId = useWatch({ control, name: "book.portraitMediaId" });
  const bookPortraitUrl =
    uploadedPortrait?.mediaId === currentPortraitMediaId
      ? uploadedPortrait.previewUrl
      : (appearance?.portrait?.urls.card ?? null);
  const portraitUrl =
    currentPortraitMediaId === null ? (character.avatar?.urls.card ?? null) : bookPortraitUrl;

  const detailsHref = getCharacterDetailsPath({
    characterId: character.id,
    ...(contextBookId === null ? {} : { bookId: contextBookId }),
  });

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
          input: toBookUpdate(values.book, maskedFields),
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
        {contextBookId === null ? null : (
          <div className="motion-safe:animate-in motion-safe:duration-500 motion-safe:slide-in-from-bottom-2">
            <CharacterPortraitPanel
              control={control}
              maskedFields={maskedFields}
              onPortraitUpload={setUploadedPortrait}
              portraitUrl={portraitUrl}
            />
          </div>
        )}

        <div className="order-last motion-safe:animate-in motion-safe:duration-500 motion-safe:slide-in-from-bottom-2 lg:order-none">
          <CharacterEditPreview control={control} imageUrl={portraitUrl} />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:slide-in-from-bottom-2 lg:col-start-1 lg:row-start-1">
        {contextBookId === null ? null : (
          <BookCharacterMainSection control={control} errors={errors} register={register} />
        )}

        {contextBookId === null ? null : (
          <BookCharacterNarrativeSection
            bookId={contextBookId}
            control={control}
            errors={errors}
            pageMax={pageCeiling.max}
            register={register}
          />
        )}

        <CharacterGlobalSection control={control} errors={errors} register={register} />

        {contextBookId === null ? null : (
          <BookCharacterInheritanceSection
            control={control}
            errors={errors}
            maskedFields={maskedFields}
          />
        )}

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
