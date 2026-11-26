import type { Nullable, ProfileView, UpdateProfileInput } from "@app/shared";

import { describe, expect, it } from "vitest";

import type {
  ProfileFieldIssue,
  ProfileFormField,
  ProfileFormInput,
  ProfileFormValues,
} from "./profile-form";

import {
  changedProfileFields,
  PROFILE_NICKNAME_TAKEN,
  profileFieldIssue,
  ProfileFormSchema,
  toProfileFormInput,
} from "./profile-form";
import { makeProfile } from "./profile.fixtures";

const OPENED_PROFILE = makeProfile({ bio: "Reads fantasy at night", name: "Olena" });

const VALID_FORM = { bio: "", name: "Olena", nickname: "" } satisfies ProfileFormInput;

function fieldIssue({
  field,
  value,
}: {
  field: ProfileFormField;
  value: string;
}): Nullable<ProfileFieldIssue> {
  const result = ProfileFormSchema.safeParse({ ...VALID_FORM, [field]: value });
  if (result.success) return null;
  const issue = result.error.issues.find((candidate) => candidate.path[0] === field);
  return issue === undefined ? null : profileFieldIssue({ field, type: issue.code });
}

function parsedForm(edits: Partial<ProfileFormInput>): ProfileFormValues {
  return ProfileFormSchema.parse({ ...VALID_FORM, ...edits });
}

function submittedPayload({
  edits,
  initial,
}: {
  edits: Partial<ProfileFormInput>;
  initial: ProfileView;
}): UpdateProfileInput {
  return changedProfileFields({
    initial,
    values: ProfileFormSchema.parse({ ...toProfileFormInput(initial), ...edits }),
  });
}

describe("ProfileFormSchema name", () => {
  it.each(["", "   ", "O", "  O  "])("rejects the name %j as too short", (value) => {
    expect(fieldIssue({ field: "name", value })).toBe("nameLength");
  });

  it("rejects a name of 51 characters as too long", () => {
    expect(fieldIssue({ field: "name", value: "a".repeat(51) })).toBe("nameLength");
  });

  it("rejects a name with HTML", () => {
    expect(fieldIssue({ field: "name", value: "<b>Olena</b>" })).toBe("htmlNotAllowed");
  });

  it("accepts a two-character name and drops its surrounding spaces", () => {
    expect(parsedForm({ name: "  Ol  " }).name).toBe("Ol");
  });

  it("accepts a name of 50 characters once its surrounding spaces are dropped", () => {
    expect(parsedForm({ name: ` ${"a".repeat(50)} ` }).name).toBe("a".repeat(50));
  });
});

describe("ProfileFormSchema nickname", () => {
  it.each(["", "   "])("turns the nickname %j into null", (value) => {
    expect(parsedForm({ nickname: value }).nickname).toBeNull();
  });

  it.each(["@olena_reads", "  @olena_reads  "])("strips the leading @ from %j", (value) => {
    expect(parsedForm({ nickname: value }).nickname).toBe("olena_reads");
  });

  it.each(["олена_читає", "reader.2026", "book-worm_7"])("accepts the nickname %j", (value) => {
    expect(parsedForm({ nickname: value }).nickname).toBe(value);
  });

  it("accepts a nickname of three characters", () => {
    expect(parsedForm({ nickname: "abc" }).nickname).toBe("abc");
  });

  it("accepts a nickname of 30 characters", () => {
    expect(parsedForm({ nickname: "a".repeat(30) }).nickname).toBe("a".repeat(30));
  });

  it("rejects a nickname of two characters as too short", () => {
    expect(fieldIssue({ field: "nickname", value: "ab" })).toBe("nicknameLength");
  });

  it("counts the length after the leading @ is stripped", () => {
    expect(fieldIssue({ field: "nickname", value: "@ab" })).toBe("nicknameLength");
  });

  it("rejects a nickname of 31 characters as too long", () => {
    expect(fieldIssue({ field: "nickname", value: "a".repeat(31) })).toBe("nicknameLength");
  });

  it.each(["olena reads", "olena!", "olena@reads", "@@olena"])(
    "rejects the nickname %j for its characters",
    (value) => {
      expect(fieldIssue({ field: "nickname", value })).toBe("nicknameFormat");
    },
  );
});

describe("ProfileFormSchema bio", () => {
  it.each(["", "   "])("turns the bio %j into null", (value) => {
    expect(parsedForm({ bio: value }).bio).toBeNull();
  });

  it("drops the surrounding spaces of the bio", () => {
    expect(parsedForm({ bio: "  Collects first editions  " }).bio).toBe("Collects first editions");
  });

  it("accepts a bio of 300 characters once its surrounding spaces are dropped", () => {
    expect(parsedForm({ bio: ` ${"a".repeat(300)} ` }).bio).toBe("a".repeat(300));
  });

  it("rejects a bio of 301 characters as too long", () => {
    expect(fieldIssue({ field: "bio", value: "a".repeat(301) })).toBe("bioTooLong");
  });

  it("rejects a bio with HTML", () => {
    expect(fieldIssue({ field: "bio", value: "<script>alert(1)</script>" })).toBe("htmlNotAllowed");
  });
});

describe("profileFieldIssue", () => {
  it("reports a nickname the server found taken", () => {
    expect(profileFieldIssue({ field: "nickname", type: PROFILE_NICKNAME_TAKEN })).toBe(
      "nicknameTaken",
    );
  });

  it("falls back to the generic issue for a type it does not know", () => {
    expect(profileFieldIssue({ field: "name", type: "invalid_type" })).toBe("invalid");
  });
});

describe("changedProfileFields", () => {
  it("gives an empty payload for an untouched form", () => {
    expect(submittedPayload({ edits: {}, initial: OPENED_PROFILE })).toEqual({});
  });

  it("sends only the field that changed", () => {
    expect(
      submittedPayload({ edits: { name: "Olena Petrenko" }, initial: OPENED_PROFILE }),
    ).toEqual({ name: "Olena Petrenko" });
  });

  it("sends every field that changed", () => {
    expect(
      submittedPayload({
        edits: { bio: "Collects first editions", name: "Olena Petrenko", nickname: "petrenko" },
        initial: OPENED_PROFILE,
      }),
    ).toEqual({ bio: "Collects first editions", name: "Olena Petrenko", nickname: "petrenko" });
  });

  it("sends a changed value without its surrounding spaces", () => {
    expect(
      submittedPayload({ edits: { name: "  Olena Petrenko  " }, initial: OPENED_PROFILE }),
    ).toEqual({ name: "Olena Petrenko" });
  });

  it("sends a new nickname without its leading @", () => {
    expect(
      submittedPayload({
        edits: { nickname: "@petrenko" },
        initial: { ...OPENED_PROFILE, nickname: null },
      }),
    ).toEqual({ nickname: "petrenko" });
  });

  it("sends null for an emptied nickname", () => {
    expect(submittedPayload({ edits: { nickname: "" }, initial: OPENED_PROFILE })).toEqual({
      nickname: null,
    });
  });

  it.each(["", "   "])("sends null for a bio emptied to %j", (bio) => {
    expect(submittedPayload({ edits: { bio }, initial: OPENED_PROFILE })).toEqual({ bio: null });
  });

  it("treats a name that differs only by surrounding spaces as unchanged", () => {
    expect(submittedPayload({ edits: { name: "  Olena  " }, initial: OPENED_PROFILE })).toEqual({});
  });

  it("treats a bio that differs only by surrounding spaces as unchanged", () => {
    expect(
      submittedPayload({ edits: { bio: "  Reads fantasy at night  " }, initial: OPENED_PROFILE }),
    ).toEqual({});
  });

  it.each(["  olena_reads  ", "@olena_reads", " @olena_reads "])(
    "treats the nickname %j as unchanged",
    (nickname) => {
      expect(submittedPayload({ edits: { nickname }, initial: OPENED_PROFILE })).toEqual({});
    },
  );

  it("treats blank fields of a profile without a nickname or bio as unchanged", () => {
    expect(
      submittedPayload({
        edits: { bio: "   ", nickname: "  " },
        initial: { ...OPENED_PROFILE, bio: null, nickname: null },
      }),
    ).toEqual({});
  });

  it("never sends the email, even when the submitted form carries one", () => {
    const values = ProfileFormSchema.parse({
      ...toProfileFormInput(OPENED_PROFILE),
      email: "changed@book.nest",
      name: "Olena Petrenko",
    });

    expect(changedProfileFields({ initial: OPENED_PROFILE, values })).toEqual({
      name: "Olena Petrenko",
    });
  });
});
