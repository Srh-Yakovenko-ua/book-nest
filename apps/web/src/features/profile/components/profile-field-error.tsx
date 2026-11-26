"use client";

import type { FieldError as RhfFieldError } from "react-hook-form";

import { PROFILE_INPUT_LIMITS } from "@app/shared";
import { useTranslations } from "next-intl";

import { FieldError } from "@/components/ui/field-error";
import { assertNever } from "@/lib/assert-never";

import type { ProfileFormField } from "../model/profile-form";

import { profileFieldIssue } from "../model/profile-form";

type ProfileFieldErrorProps = {
  error: RhfFieldError | undefined;
  field: ProfileFormField;
  id: string;
};

export function ProfileFieldError({ error, field, id }: ProfileFieldErrorProps) {
  const t = useTranslations("profile.errors");
  if (error === undefined) return null;

  const issue = profileFieldIssue({ field, type: error.type });

  function message(): string {
    switch (issue) {
      case "bioTooLong":
        return t("bioTooLong", { max: PROFILE_INPUT_LIMITS.bioMax });
      case "htmlNotAllowed":
        return t("htmlNotAllowed");
      case "invalid":
        return t("invalid");
      case "nameLength":
        return t("nameLength", {
          max: PROFILE_INPUT_LIMITS.nameMax,
          min: PROFILE_INPUT_LIMITS.nameMin,
        });
      case "nicknameFormat":
        return t("nicknameFormat");
      case "nicknameLength":
        return t("nicknameLength", {
          max: PROFILE_INPUT_LIMITS.nicknameMax,
          min: PROFILE_INPUT_LIMITS.nicknameMin,
        });
      case "nicknameTaken":
        return t("nicknameTaken");
      default:
        return assertNever(issue);
    }
  }

  return <FieldError error={{ message: message() }} id={id} />;
}
