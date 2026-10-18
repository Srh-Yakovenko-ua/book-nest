"use client";

import { useTranslations } from "next-intl";

import type { RelationshipFormMessages } from "./relationship-form-schema";

import { RELATIONSHIP_FORM_LIMITS } from "./relationship-form-schema";

export function useRelationshipFormMessages(): RelationshipFormMessages {
  const t = useTranslations("relationships.editor.errors");

  return {
    audioInvalid: t("audioInvalid"),
    bookRequired: t("bookRequired"),
    chapterTooLong: t("tooLong", { max: RELATIONSHIP_FORM_LIMITS.chapterMax }),
    customTypeRequired: t("customTypeRequired"),
    customTypeTooLong: t("tooLong", { max: RELATIONSHIP_FORM_LIMITS.customTypeMax }),
    descriptionTooLong: t("tooLong", { max: RELATIONSHIP_FORM_LIMITS.descriptionMax }),
    labelTooLong: t("tooLong", { max: RELATIONSHIP_FORM_LIMITS.labelMax }),
    pageInvalid: t("pageInvalid"),
    participantRequired: t("participantRequired"),
    typeRequired: t("typeRequired"),
  };
}
