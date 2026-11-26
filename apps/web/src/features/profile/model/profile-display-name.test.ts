import type { ProfileView } from "@app/shared";

import { describe, expect, it } from "vitest";

import { profileDisplayName } from "./profile-display-name";

const IDENTITY = {
  email: "olena@book.nest",
  name: "Olena Petrenko",
  nickname: "olena_reads",
} satisfies Pick<ProfileView, "email" | "name" | "nickname">;

describe("profileDisplayName", () => {
  it("shows the name when it is filled", () => {
    expect(profileDisplayName(IDENTITY)).toBe("Olena Petrenko");
  });

  it.each(["", "   "])("falls back to the nickname when the name is %j", (name) => {
    expect(profileDisplayName({ ...IDENTITY, name })).toBe("olena_reads");
  });

  it.each([null, "", "   "])(
    "falls back to the email when the name is empty and the nickname is %j",
    (nickname) => {
      expect(profileDisplayName({ ...IDENTITY, name: "", nickname })).toBe("olena@book.nest");
    },
  );
});
