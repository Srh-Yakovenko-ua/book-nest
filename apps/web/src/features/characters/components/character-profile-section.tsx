"use client";

import type { BookCharacterView, CharacterDetailsView } from "@app/shared";

import { useTranslations } from "next-intl";

import { useSpeciesLabel } from "@/features/species";

import type { CharacterRevealControl } from "../model/character-spoiler";

import {
  BookBasicsFields,
  BookImpressionFields,
  hasBookBasics,
  hasBookImpression,
} from "./character-book-section";
import { CharacterOverviewCard } from "./character-overview-card";

type ProfileCardProps = {
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

export function CharacterAttitudeCard({ appearance, character, reveal }: ProfileCardProps) {
  const t = useTranslations("characters.edit");
  const tAttitude = useTranslations("characters.attitude");
  const tPage = useTranslations("characters.page");

  return (
    <CharacterOverviewCard
      groups={[
        character.globalAttitude === null
          ? null
          : {
              content: (
                <ProfileFactList
                  facts={[
                    {
                      key: "attitude",
                      label: tPage("attitude"),
                      value: tAttitude(character.globalAttitude),
                    },
                  ]}
                />
              ),
              key: "global",
              title: t("attitudeGlobalGroup"),
            },
        appearance === undefined || !hasBookImpression(appearance)
          ? null
          : {
              content: <BookImpressionFields appearance={appearance} reveal={reveal} />,
              key: "book",
              title: t("attitudeBookGroup"),
            },
      ]}
      icon="heart"
      title={t("attitudeSection")}
    />
  );
}

export function CharacterBasicsCard({ appearance, character, reveal }: ProfileCardProps) {
  const t = useTranslations("characters.edit");
  const facts = useGlobalProfileFacts(character);

  return (
    <CharacterOverviewCard
      groups={[
        facts.length === 0
          ? null
          : {
              content: <ProfileFactList facts={facts} />,
              key: "global",
              title: t("basicsGlobalGroup"),
            },
        appearance === undefined || !hasBookBasics(appearance)
          ? null
          : {
              content: <BookBasicsFields appearance={appearance} reveal={reveal} />,
              key: "book",
              title: t("basicsBookGroup"),
            },
      ]}
      icon="user"
      title={t("basicsSection")}
    />
  );
}

export function useGlobalProfileFacts(character: CharacterDetailsView): ProfileFact[] {
  const t = useTranslations("characters.page");
  const tEntity = useTranslations("characters.entityKind");
  const tGender = useTranslations("characters.gender");
  const speciesLabel = useSpeciesLabel();

  const pronouns = character.pronouns?.trim() ?? "";
  const species = speciesLabel(character.species);
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
  if (pronouns.length > 0) {
    facts.push({ key: "pronouns", label: t("pronouns"), value: pronouns });
  }
  if (species !== null) {
    facts.push({ key: "species", label: t("species"), value: species });
  }
  return facts;
}

function ProfileFactList({ facts }: { facts: readonly ProfileFact[] }) {
  return (
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
  );
}
