import type { ProfileView, UpdateProfileInput } from "@app/shared";

import { UpdateProfileInputSchema } from "@app/shared";
import { z } from "zod";

import { assertNever } from "@/lib/assert-never";
import { emptyToNull } from "@/lib/empty-to-null";

const profileFields = UpdateProfileInputSchema.shape;

export const PROFILE_NICKNAME_TAKEN = "nicknameTaken";

export const ProfileFormSchema = z.object({
  bio: z.string().transform(emptyToNull).pipe(profileFields.bio.unwrap()),
  name: profileFields.name.unwrap(),
  nickname: z.string().transform(emptyToNull).pipe(profileFields.nickname.unwrap()),
});

export type ProfileFieldIssue =
  | "bioTooLong"
  | "htmlNotAllowed"
  | "invalid"
  | "nameLength"
  | "nicknameFormat"
  | "nicknameLength"
  | "nicknameTaken";

export type ProfileFormField = keyof ProfileFormInput;

export type ProfileFormInput = z.input<typeof ProfileFormSchema>;

export type ProfileFormValues = z.output<typeof ProfileFormSchema>;

export function changedProfileFields({
  initial,
  values,
}: {
  initial: ProfileView;
  values: ProfileFormValues;
}): UpdateProfileInput {
  return {
    ...(values.bio === initial.bio ? {} : { bio: values.bio }),
    ...(values.name === initial.name ? {} : { name: values.name }),
    ...(values.nickname === initial.nickname ? {} : { nickname: values.nickname }),
  };
}

export function profileFieldIssue({
  field,
  type,
}: {
  field: ProfileFormField;
  type: string;
}): ProfileFieldIssue {
  if (type === PROFILE_NICKNAME_TAKEN) return "nicknameTaken";
  if (type === "custom") return "htmlNotAllowed";
  if (type === "invalid_format" && field === "nickname") return "nicknameFormat";
  if (type !== "too_small" && type !== "too_big") return "invalid";

  switch (field) {
    case "bio":
      return "bioTooLong";
    case "name":
      return "nameLength";
    case "nickname":
      return "nicknameLength";
    default:
      return assertNever(field);
  }
}

export function toProfileFormInput(profile: ProfileView): ProfileFormInput {
  return {
    bio: profile.bio ?? "",
    name: profile.name,
    nickname: profile.nickname ?? "",
  };
}
