"use client";

import type { BookCharacterView, CharacterDetailsView } from "@app/shared";

import { CHARACTER_NAME_MAX } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Skeleton } from "@/components/ui/skeleton";
import { DiscardConfirmDialog } from "@/features/books";
import { useRouter } from "@/i18n/navigation";
import { applyFieldErrors } from "@/lib/api-errors";

import type { CharacterEditValues } from "../model/character-edit-form";

import { useCharacterDetails } from "../api/use-character-details";
import { useUpdateBookCharacter } from "../api/use-update-book-character";
import { useUpdateCharacter } from "../api/use-update-character";
import {
  buildCharacterEditSchema,
  isScopeDirty,
  toBookUpdate,
  toCharacterEditValues,
  toGlobalUpdate,
} from "../model/character-edit-form";
import { getCharacterDetailsPath } from "../model/character-routes";
import { ALL_REVEAL_FIELD_KEYS } from "../model/character-spoiler";
import {
  BookCharacterInheritanceSection,
  BookCharacterMainSection,
  BookCharacterNarrativeSection,
  BookCharacterSpoilerSection,
  CharacterAliasesSection,
  CharacterGlobalSection,
} from "./character-edit-sections";
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
  const router = useRouter();
  const updateCharacter = useUpdateCharacter();
  const updateBookCharacter = useUpdateBookCharacter();

  const initialValues = toCharacterEditValues(character, contextBookId ?? undefined);
  const [baseline, setBaseline] = useState<CharacterEditValues>(initialValues);
  const [discardOpen, setDiscardOpen] = useState(false);

  const form = useForm<CharacterEditValues>({
    defaultValues: initialValues,
    mode: "onTouched",
    resolver: zodResolver(
      buildCharacterEditSchema({
        aliasDuplicate: tAliases("errorDuplicate"),
        aliasReservedBook: tAliases("errorSameAsDisplayName"),
        aliasReservedGlobal: tAliases("errorSameAsName"),
        customGenderRequired: tErrors("customGenderRequired"),
        firstAppearancePageInvalid: t("firstAppearancePageInvalid"),
        nameRequired: tErrors("nameRequired"),
        nameTooLong: tErrors("nameTooLong", { max: CHARACTER_NAME_MAX }),
      }),
    ),
  });

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = form;

  const current = useWatch({ control });
  const currentValues = current as CharacterEditValues;
  const maskedFields = appearance?.hiddenFields ?? [];
  const globalDirty = isScopeDirty({ baseline, current: currentValues, scope: "global" });
  const bookDirty =
    contextBookId !== null &&
    isScopeDirty({ baseline, current: currentValues, maskedFields, scope: "book" });
  const isDirty = globalDirty || bookDirty;
  const isSaving = updateCharacter.isPending || updateBookCharacter.isPending;

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
          input: toGlobalUpdate(values.global),
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
    <form className="flex flex-col gap-6" noValidate onSubmit={onSubmit}>
      {contextBookId === null ? null : (
        <BookCharacterMainSection control={control} register={register} />
      )}

      {contextBookId === null ? null : (
        <BookCharacterNarrativeSection
          control={control}
          pageError={
            <FieldError error={errors.book?.firstAppearancePage} id="character-first-page-error" />
          }
          register={register}
        />
      )}

      {contextBookId === null ? null : (
        <BookCharacterInheritanceSection
          control={control}
          globalAvatarUrl={character.avatar?.urls.card ?? null}
          maskedFields={maskedFields}
          portraitUrl={appearance?.portrait?.urls.card ?? null}
        />
      )}

      <CharacterGlobalSection
        control={control}
        nameError={<FieldError error={errors.global?.name} id="character-name-error" />}
        register={register}
      />

      <CharacterAliasesSection
        control={control}
        errors={errors}
        hasBookScope={contextBookId !== null}
      />

      {contextBookId === null ? null : <BookCharacterSpoilerSection control={control} />}

      <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-end gap-3 rounded-t-xl bg-background/80 px-4 py-3 backdrop-blur-xl backdrop-saturate-150">
        <Button disabled={isSaving} onClick={cancel} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button disabled={isSaving || !isDirty} loading={isSaving} type="submit">
          <UiIcon name="check" size={16} />
          {t("save")}
        </Button>
      </div>

      <DiscardConfirmDialog
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
  return (
    <div aria-busy className="flex flex-col gap-6" role="status">
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}
