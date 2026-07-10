import type { Nullable, UpdateProfileInput } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { UserSocialLinkModel } from "../../../generated/prisma/models.js";
import type {
  ProfileRepository,
  ProfileWithSocialLinks,
} from "../infrastructure/profile.repository.js";

import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { Prisma as PrismaNamespace } from "../../../generated/prisma/client.js";
import { ProfileService } from "./profile.service.js";

function applyUpdate(
  base: ProfileWithSocialLinks,
  data: Prisma.UserUpdateInput,
): ProfileWithSocialLinks {
  const next: ProfileWithSocialLinks = { ...base };
  if (data.name !== undefined) next.name = data.name as string;
  if (data.lastName !== undefined) next.lastName = data.lastName as Nullable<string>;
  if (data.nickname !== undefined) next.nickname = data.nickname as Nullable<string>;
  if (data.bio !== undefined) next.bio = data.bio as Nullable<string>;
  if (data.favoriteBookQuote !== undefined) {
    next.favoriteBookQuote = data.favoriteBookQuote as Nullable<string>;
  }
  if (data.favoriteGenres !== undefined) {
    next.favoriteGenres = data.favoriteGenres as string[];
  }
  if (data.dateOfBirth !== undefined) {
    next.dateOfBirth = data.dateOfBirth as Nullable<Date>;
  }
  return next;
}

function buildService(overrides: {
  findByUserId?: Nullable<ProfileWithSocialLinks>;
  update?: (userId: string, data: Prisma.UserUpdateInput) => Promise<ProfileWithSocialLinks>;
  updateError?: unknown;
}): {
  repository: { findByUserId: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  service: ProfileService;
} {
  const update =
    overrides.updateError !== undefined
      ? vi.fn().mockRejectedValue(overrides.updateError)
      : vi
          .fn()
          .mockImplementation(
            overrides.update ??
              ((_userId: string, data: Prisma.UserUpdateInput) =>
                Promise.resolve(applyUpdate(userModel(), data))),
          );

  const repository = {
    findByUserId: vi.fn().mockResolvedValue(overrides.findByUserId ?? null),
    update,
  };

  const service = new ProfileService(repository as unknown as ProfileRepository);

  return { repository, service };
}

function socialLink(overrides: Partial<UserSocialLinkModel> = {}): UserSocialLinkModel {
  return {
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    id: "22222222-2222-4222-8222-222222222222",
    label: null,
    platform: "INSTAGRAM",
    updatedAt: new Date("2026-02-02T11:00:00.000Z"),
    url: null,
    userId: "11111111-1111-4111-8111-111111111111",
    username: "reader",
    ...overrides,
  };
}

function userModel(overrides: Partial<ProfileWithSocialLinks> = {}): ProfileWithSocialLinks {
  return {
    avatarUrl: null,
    bio: null,
    createdAt: new Date("2026-01-02T03:04:05.000Z"),
    dateOfBirth: null,
    email: "reader@example.com",
    emailVerifiedAt: null,
    favoriteBookQuote: null,
    favoriteGenres: [],
    id: "11111111-1111-4111-8111-111111111111",
    lastName: null,
    name: "Reader",
    nickname: null,
    passwordHash: "stored-hash",
    role: "user",
    socialLinks: [],
    updatedAt: new Date("2026-01-03T04:05:06.000Z"),
    ...overrides,
  };
}

const USER_ID = "11111111-1111-4111-8111-111111111111";

describe("ProfileService.getProfile", () => {
  it("maps an existing user to a ProfileView with the userId", async () => {
    const { service } = buildService({ findByUserId: userModel() });

    const view = await service.getProfile(USER_ID);

    expect(view.userId).toBe(USER_ID);
    expect(view.email).toBe("reader@example.com");
    expect(view.name).toBe("Reader");
  });

  it("always reports the PASSWORD auth provider", async () => {
    const { service } = buildService({ findByUserId: userModel() });

    const view = await service.getProfile(USER_ID);

    expect(view.authProvider).toBe("PASSWORD");
  });

  it("derives emailVerified false from a null emailVerifiedAt", async () => {
    const { service } = buildService({ findByUserId: userModel({ emailVerifiedAt: null }) });

    const view = await service.getProfile(USER_ID);

    expect(view.emailVerified).toBe(false);
  });

  it("derives emailVerified true from a set emailVerifiedAt", async () => {
    const { service } = buildService({
      findByUserId: userModel({ emailVerifiedAt: new Date("2026-01-05T00:00:00.000Z") }),
    });

    const view = await service.getProfile(USER_ID);

    expect(view.emailVerified).toBe(true);
  });

  it("formats a set dateOfBirth as a YYYY-MM-DD string", async () => {
    const { service } = buildService({
      findByUserId: userModel({ dateOfBirth: new Date("1995-07-21T00:00:00.000Z") }),
    });

    const view = await service.getProfile(USER_ID);

    expect(view.dateOfBirth).toBe("1995-07-21");
  });

  it("maps a null dateOfBirth to null", async () => {
    const { service } = buildService({ findByUserId: userModel({ dateOfBirth: null }) });

    const view = await service.getProfile(USER_ID);

    expect(view.dateOfBirth).toBeNull();
  });

  it("serializes createdAt and updatedAt as ISO strings", async () => {
    const { service } = buildService({ findByUserId: userModel() });

    const view = await service.getProfile(USER_ID);

    expect(view.createdAt).toBe("2026-01-02T03:04:05.000Z");
    expect(view.updatedAt).toBe("2026-01-03T04:05:06.000Z");
  });

  it("never leaks the password hash", async () => {
    const { service } = buildService({ findByUserId: userModel() });

    const view = await service.getProfile(USER_ID);

    expect(view).not.toHaveProperty("passwordHash");
  });

  it("returns an empty socialLinks array when the user has none", async () => {
    const { service } = buildService({ findByUserId: userModel({ socialLinks: [] }) });

    const view = await service.getProfile(USER_ID);

    expect(view.socialLinks).toEqual([]);
  });

  it("maps included socialLinks rows to SocialLinkView entries", async () => {
    const { service } = buildService({
      findByUserId: userModel({
        socialLinks: [
          socialLink({
            createdAt: new Date("2026-02-01T10:00:00.000Z"),
            id: "33333333-3333-4333-8333-333333333333",
            label: "My books",
            platform: "GOODREADS",
            updatedAt: new Date("2026-02-02T11:00:00.000Z"),
            url: "https://goodreads.com/reader",
            username: "reader",
          }),
          socialLink({
            createdAt: new Date("2026-03-01T10:00:00.000Z"),
            id: "44444444-4444-4444-8444-444444444444",
            label: null,
            platform: "WEBSITE",
            updatedAt: new Date("2026-03-02T11:00:00.000Z"),
            url: "https://reader.example.com",
            username: null,
          }),
        ],
      }),
    });

    const view = await service.getProfile(USER_ID);

    expect(view.socialLinks).toEqual([
      {
        createdAt: "2026-02-01T10:00:00.000Z",
        id: "33333333-3333-4333-8333-333333333333",
        label: "My books",
        platform: "GOODREADS",
        updatedAt: "2026-02-02T11:00:00.000Z",
        url: "https://goodreads.com/reader",
        username: "reader",
      },
      {
        createdAt: "2026-03-01T10:00:00.000Z",
        id: "44444444-4444-4444-8444-444444444444",
        label: null,
        platform: "WEBSITE",
        updatedAt: "2026-03-02T11:00:00.000Z",
        url: "https://reader.example.com",
        username: null,
      },
    ]);
  });

  it("throws a NotFoundError when the user does not exist", async () => {
    const { service } = buildService({ findByUserId: null });

    await expect(service.getProfile(USER_ID)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("ProfileService.updateProfile", () => {
  it("passes only the keys present in the input to the repository", async () => {
    const { repository, service } = buildService({});
    const input: UpdateProfileInput = { bio: "Loves sci-fi", name: "Reader Two" };

    await service.updateProfile(USER_ID, input);

    expect(repository.update).toHaveBeenCalledWith(USER_ID, {
      bio: "Loves sci-fi",
      name: "Reader Two",
    });
  });

  it("omits keys that are absent from the input", async () => {
    const { repository, service } = buildService({});

    await service.updateProfile(USER_ID, { name: "Reader Two" });

    const [, data] = repository.update.mock.calls[0] as [string, Prisma.UserUpdateInput];
    expect(data).not.toHaveProperty("bio");
    expect(data).not.toHaveProperty("nickname");
    expect(data).not.toHaveProperty("favoriteGenres");
  });

  it("passes null through for a clearable bio", async () => {
    const { repository, service } = buildService({});

    await service.updateProfile(USER_ID, { bio: null });

    expect(repository.update).toHaveBeenCalledWith(USER_ID, { bio: null });
  });

  it("passes null through for a clearable nickname", async () => {
    const { repository, service } = buildService({});

    await service.updateProfile(USER_ID, { nickname: null });

    expect(repository.update).toHaveBeenCalledWith(USER_ID, { nickname: null });
  });

  it("passes null through for a clearable dateOfBirth", async () => {
    const { repository, service } = buildService({});

    await service.updateProfile(USER_ID, { dateOfBirth: null });

    expect(repository.update).toHaveBeenCalledWith(USER_ID, { dateOfBirth: null });
  });

  it("converts a YYYY-MM-DD dateOfBirth into a UTC-midnight Date", async () => {
    const { repository, service } = buildService({});

    await service.updateProfile(USER_ID, { dateOfBirth: "1995-07-21" });

    const [, data] = repository.update.mock.calls[0] as [string, Prisma.UserUpdateInput];
    expect(data.dateOfBirth).toBeInstanceOf(Date);
    expect((data.dateOfBirth as Date).toISOString()).toBe("1995-07-21T00:00:00.000Z");
  });

  it("returns the mapped ProfileView built from the updated row", async () => {
    const { service } = buildService({
      update: (userId, data) => Promise.resolve(applyUpdate(userModel({ id: userId }), data)),
    });

    const view = await service.updateProfile(USER_ID, { name: "Updated Name" });

    expect(view.name).toBe("Updated Name");
    expect(view.userId).toBe(USER_ID);
  });

  it("maps a Prisma P2002 unique violation into a ConflictError", async () => {
    const conflict = new PrismaNamespace.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`nickname`)",
      { clientVersion: "7.8.0", code: "P2002", meta: { target: ["nickname"] } },
    );
    const { service } = buildService({ updateError: conflict });

    await expect(service.updateProfile(USER_ID, { nickname: "taken" })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("rethrows a non-P2002 Prisma error unchanged", async () => {
    const other = new PrismaNamespace.PrismaClientKnownRequestError("Record not found", {
      clientVersion: "7.8.0",
      code: "P2025",
    });
    const { service } = buildService({ updateError: other });

    await expect(service.updateProfile(USER_ID, { name: "Reader Two" })).rejects.toBe(other);
  });
});
