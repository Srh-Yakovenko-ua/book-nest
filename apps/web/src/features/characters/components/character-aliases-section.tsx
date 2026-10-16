"use client";

import type { Ref } from "react";
import type {
  Control,
  FieldError,
  FieldErrors,
  UseFormGetValues,
  UseFormSetValue,
} from "react-hook-form";

import { useTranslations } from "next-intl";
import { useImperativeHandle } from "react";

import { Separator } from "@/components/ui/separator";
import { DiscardConfirmDialog } from "@/features/books";

import type { CharacterEditScope, CharacterEditValues } from "../model/character-edit-form";

import {
  type CharacterAliasesHandle,
  useCharacterAliasEditor,
} from "../model/use-character-alias-editor";
import { CharacterAliasEditor } from "./character-alias-editor";
import { CharacterAliasGroup } from "./character-alias-group";
import { EditSection } from "./character-edit-sections";

type AliasFieldErrors = NonNullable<FieldErrors<CharacterEditValues>["global"]>["aliases"];

type CharacterAliasesSectionProps = {
  control: Control<CharacterEditValues>;
  errors: FieldErrors<CharacterEditValues>;
  getValues: UseFormGetValues<CharacterEditValues>;
  hasBookScope: boolean;
  onDraftDirtyChange: (dirty: boolean) => void;
  ref: Ref<CharacterAliasesHandle>;
  saving: boolean;
  setValue: UseFormSetValue<CharacterEditValues>;
};

export function CharacterAliasesSection({
  control,
  errors,
  getValues,
  hasBookScope,
  onDraftDirtyChange,
  ref,
  saving,
  setValue,
}: CharacterAliasesSectionProps) {
  const t = useTranslations("characters.aliases");
  const tDiscardChanges = useTranslations("common.discardChanges");
  const aliasEditor = useCharacterAliasEditor({
    control,
    getValues,
    onDraftDirtyChange,
    saving,
    setValue,
  });

  useImperativeHandle(ref, () => aliasEditor.handle);

  function renderGroup(scope: CharacterEditScope, scopeErrors: AliasFieldErrors) {
    const group = aliasEditor.groupOf(scope);
    const editor = aliasEditor.editorOf(scope);
    return (
      <CharacterAliasGroup
        active={group.active}
        addButtonRef={group.addButtonRef}
        chipButtonRef={group.chipButtonRef}
        editor={
          editor === null ? null : (
            <CharacterAliasEditor
              canConfirm={editor.canConfirm}
              draft={editor.draft}
              error={editor.error}
              key={editor.identity}
              nameRef={editor.nameRef}
              notice={editor.notice}
              onCancel={editor.onCancel}
              onChange={editor.onChange}
              onConfirm={editor.onConfirm}
              originalName={editor.originalName}
              scope={scope}
            />
          )
        }
        entries={group.entries}
        errors={aliasNameErrors(scopeErrors, group.entries.length)}
        onAdd={group.onAdd}
        onEdit={group.onEdit}
        onRemove={group.onRemove}
        onToggleSpoiler={group.onToggleSpoiler}
        reservedName={group.reservedName}
        scope={scope}
      />
    );
  }

  return (
    <EditSection description={t("sectionHint")} icon="tag" title={t("sectionTitle")}>
      {renderGroup("global", errors.global?.aliases)}

      {hasBookScope ? (
        <>
          <Separator />
          {renderGroup("book", errors.book?.aliases)}
        </>
      ) : null}

      <span aria-live="polite" className="sr-only">
        {aliasEditor.announcement}
      </span>

      <DiscardConfirmDialog
        cancelLabel={tDiscardChanges("cancel")}
        confirmLabel={t("discard.confirm")}
        description={t("discard.description")}
        onCloseAutoFocus={aliasEditor.discardDialog.onCloseAutoFocus}
        onConfirm={aliasEditor.discardDialog.onConfirm}
        onOpenChange={aliasEditor.discardDialog.onOpenChange}
        open={aliasEditor.discardDialog.open}
        title={t("discard.title")}
      />
    </EditSection>
  );
}

function aliasNameErrors(entries: AliasFieldErrors, count: number): (FieldError | undefined)[] {
  return Array.from({ length: count }, (_unused, index) => entries?.[index]?.name);
}
