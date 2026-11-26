import type { ProfileView } from "@app/shared";

type ProfileIdentity = Pick<ProfileView, "email" | "name" | "nickname">;

export function profileDisplayName(profile: ProfileIdentity): string {
  const candidates = [profile.name, profile.nickname, profile.email].map(
    (value) => value?.trim() ?? "",
  );
  return candidates.find((value) => value.length > 0) ?? "";
}
