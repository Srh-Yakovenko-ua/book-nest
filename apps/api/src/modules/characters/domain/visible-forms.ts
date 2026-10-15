import type { CharacterRevealFieldKey } from "@app/shared";

export type VisibleForms<TForm extends FormVisibilityMember> = {
  forms: TForm[];
  hiddenFields: FormsRevealKey[];
};

type FormsRevealKey = Extract<CharacterRevealFieldKey, "forms">;

type FormVisibilityMember = {
  isSpoiler: boolean;
};

export function selectVisibleForms<TForm extends FormVisibilityMember>({
  forms,
  revealedFields,
}: {
  forms: readonly TForm[];
  revealedFields: ReadonlySet<CharacterRevealFieldKey>;
}): VisibleForms<TForm> {
  if (revealedFields.has("forms")) {
    return { forms: [...forms], hiddenFields: [] };
  }
  const visibleForms = forms.filter((form) => !form.isSpoiler);
  const hasHiddenForms = visibleForms.length < forms.length;
  return { forms: visibleForms, hiddenFields: hasHiddenForms ? ["forms"] : [] };
}
