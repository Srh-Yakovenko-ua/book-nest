"use client";

import type { BookCharacterView, CharacterDetailsView } from "@app/shared";

import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/empty-state";
import { useRouter } from "@/i18n/navigation";

import { type CharacterRevealControl, isFieldHidden } from "../model/character-spoiler";
import { CharacterAliasCard, hasAliases } from "./character-alias-card";
import {
  CharacterDescriptionsCard,
  CharacterNarrativeCard,
  hasBookOverview,
} from "./character-book-section";
import { CharacterFormsSection } from "./character-forms-section";
import {
  CharacterAttitudeCard,
  CharacterBasicsCard,
  useGlobalProfileFacts,
} from "./character-profile-section";

type CharacterOverviewProps = {
  appearance: BookCharacterView | undefined;
  character: CharacterDetailsView;
  editHref: string;
  reveal: CharacterRevealControl;
};

export function CharacterOverview({
  appearance,
  character,
  editHref,
  reveal,
}: CharacterOverviewProps) {
  const globalFacts = useGlobalProfileFacts(character);
  const hasContent =
    globalFacts.length > 0 ||
    character.globalAttitude !== null ||
    (appearance !== undefined && hasBookOverview(appearance)) ||
    hasAliases({ appearance, character }) ||
    character.forms.length > 0 ||
    isFieldHidden(character.hiddenFields, "forms");

  if (!hasContent) return <OverviewEmptyState character={character} editHref={editHref} />;

  return (
    <>
      <CharacterBasicsCard appearance={appearance} character={character} reveal={reveal} />
      {appearance === undefined ? null : (
        <>
          <CharacterDescriptionsCard appearance={appearance} reveal={reveal} />
          <CharacterNarrativeCard appearance={appearance} reveal={reveal} />
        </>
      )}
      <CharacterAttitudeCard appearance={appearance} character={character} reveal={reveal} />
      <CharacterAliasCard appearance={appearance} character={character} reveal={reveal} />
      <CharacterFormsSection character={character} reveal={reveal} />
    </>
  );
}

function OverviewEmptyState({
  character,
  editHref,
}: {
  character: CharacterDetailsView;
  editHref: string;
}) {
  const t = useTranslations("characters.page");
  const router = useRouter();
  const hasNeutralDescription = (character.neutralDescription?.trim() ?? "").length > 0;
  const copy = hasNeutralDescription
    ? {
        desc: t("overviewEmpty.noAdditional.description"),
        title: t("overviewEmpty.noAdditional.title"),
      }
    : {
        desc: t("overviewEmpty.noInformation.description"),
        title: t("overviewEmpty.noInformation.title"),
      };

  return (
    <EmptyState
      onPrimary={() => router.push(editHref)}
      state={{
        ...copy,
        illu: "empty-authors",
        illuSize: "sm",
        primary: { icon: "edit", label: t("edit") },
      }}
    />
  );
}
