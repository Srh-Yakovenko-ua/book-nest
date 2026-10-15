"use client";

import type { BookCharacterView, CharacterDetailsView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { FormSection } from "@/features/books";
import { useSpeciesLabel } from "@/features/species";

import { type CharacterRevealControl, isFieldHidden } from "../model/character-spoiler";
import { CharacterAliasCard } from "./character-alias-card";
import { CharacterClampedText } from "./character-clamped-text";

type CharacterProfileSectionProps = {
  appearance: BookCharacterView | undefined;
  character: CharacterDetailsView;
  reveal: CharacterRevealControl;
};

type ProfileFact = {
  key: string;
  label: string;
  value: string;
};

const UNKNOWN_VALUE = "unknown";

export function CharacterProfileSection({
  appearance,
  character,
  reveal,
}: CharacterProfileSectionProps) {
  const t = useTranslations("characters.page");
  const headingId = useId();
  const facts = useProfileFacts({ appearance, character });

  const neutralDescription = character.neutralDescription?.trim() ?? "";
  const globalAliases = character.aliases.filter((alias) => alias.bookId === null);
  const globalAliasesHidden = isFieldHidden(character.hiddenFields, "globalAliases");

  if (
    facts.length === 0 &&
    neutralDescription.length === 0 &&
    globalAliases.length === 0 &&
    !globalAliasesHidden
  ) {
    return null;
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 className="font-heading text-xl text-ink" id={headingId}>
        {t("profileSection")}
      </h2>

      {facts.length === 0 ? null : (
        <FormSection icon="info" title={t("generalInfoCard")}>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {facts.map((fact) => (
              <div className="flex flex-col gap-1" key={fact.key}>
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {fact.label}
                </dt>
                <dd className="text-sm text-foreground">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </FormSection>
      )}

      {neutralDescription.length === 0 ? null : (
        <FormSection icon="note" title={t("neutralDescription")}>
          <CharacterClampedText text={neutralDescription} />
        </FormSection>
      )}

      <CharacterAliasCard
        aliases={globalAliases}
        field="globalAliases"
        hidden={globalAliasesHidden}
        reveal={reveal}
        title={t("globalAliases")}
      />
    </section>
  );
}

function useProfileFacts({
  appearance,
  character,
}: {
  appearance: BookCharacterView | undefined;
  character: CharacterDetailsView;
}): ProfileFact[] {
  const t = useTranslations("characters.page");
  const tAttitude = useTranslations("characters.attitude");
  const tEntity = useTranslations("characters.entityKind");
  const tGender = useTranslations("characters.gender");
  const speciesLabel = useSpeciesLabel();

  const showsGlobalSpecies = appearance === undefined || appearance.speciesOverride !== null;
  const showsGlobalAttitude = appearance === undefined || appearance.attitude !== null;
  const pronouns = character.pronouns?.trim() ?? "";
  const facts: ProfileFact[] = [];

  if (character.entityKind !== UNKNOWN_VALUE) {
    facts.push({ key: "entityKind", label: t("entityKind"), value: tEntity(character.entityKind) });
  }
  if (character.gender !== UNKNOWN_VALUE) {
    facts.push({
      key: "gender",
      label: t("gender"),
      value:
        character.gender === "custom"
          ? (character.customGender ?? tGender("custom"))
          : tGender(character.gender),
    });
  }
  const species = showsGlobalSpecies ? speciesLabel(character.species) : null;
  if (species !== null) {
    facts.push({ key: "species", label: t("species"), value: species });
  }
  if (pronouns.length > 0) {
    facts.push({ key: "pronouns", label: t("pronouns"), value: pronouns });
  }
  if (showsGlobalAttitude && character.globalAttitude !== null) {
    facts.push({
      key: "attitude",
      label: t("attitude"),
      value: tAttitude(character.globalAttitude),
    });
  }
  return facts;
}
