import type { CreateSocialLinkInput, UpdateSocialLinkInput } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { UserSocialLinkModel } from "../../../generated/prisma/models.js";
import type { SocialLinkRepository } from "../infrastructure/social-link.repository.js";

import { BadRequestError, ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { SocialLinkService } from "./social-link.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "99999999-9999-4999-8999-999999999999";
const LINK_ID = "22222222-2222-4222-8222-222222222222";

function buildService(overrides: {
  create?: UserSocialLinkModel;
  findById?: null | UserSocialLinkModel;
  listByUserId?: UserSocialLinkModel[];
  update?: UserSocialLinkModel;
}): {
  repository: {
    create: ReturnType<typeof vi.fn>;
    deleteById: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    listByUserId: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  service: SocialLinkService;
} {
  const repository = {
    create: vi.fn().mockResolvedValue(overrides.create ?? socialLink()),
    deleteById: vi.fn().mockResolvedValue(socialLink()),
    findById: vi.fn().mockResolvedValue(overrides.findById ?? null),
    listByUserId: vi.fn().mockResolvedValue(overrides.listByUserId ?? []),
    update: vi.fn().mockResolvedValue(overrides.update ?? socialLink()),
  };

  const service = new SocialLinkService(repository as unknown as SocialLinkRepository);

  return { repository, service };
}

function socialLink(overrides: Partial<UserSocialLinkModel> = {}): UserSocialLinkModel {
  return {
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    id: LINK_ID,
    label: null,
    platform: "INSTAGRAM",
    updatedAt: new Date("2026-02-02T11:00:00.000Z"),
    url: null,
    userId: USER_ID,
    username: "reader",
    ...overrides,
  };
}

describe("SocialLinkService.create", () => {
  it("returns the mapped view on the happy path", async () => {
    const created = socialLink({
      label: "My books",
      platform: "GOODREADS",
      url: "https://goodreads.com/reader",
      username: "reader",
    });
    const { service } = buildService({ create: created, listByUserId: [] });
    const input: CreateSocialLinkInput = {
      label: "My books",
      platform: "GOODREADS",
      url: "https://goodreads.com/reader",
      username: "reader",
    };

    const view = await service.create(USER_ID, input);

    expect(view).toEqual({
      createdAt: "2026-02-01T10:00:00.000Z",
      id: LINK_ID,
      label: "My books",
      platform: "GOODREADS",
      updatedAt: "2026-02-02T11:00:00.000Z",
      url: "https://goodreads.com/reader",
      username: "reader",
    });
  });

  it("passes the normalized data to the repository create call", async () => {
    const { repository, service } = buildService({ listByUserId: [] });

    await service.create(USER_ID, { platform: "INSTAGRAM", username: "reader" });

    expect(repository.create).toHaveBeenCalledWith(USER_ID, {
      label: null,
      platform: "INSTAGRAM",
      url: null,
      username: "reader",
    });
  });

  it("throws BadRequestError when the user already has 10 links", async () => {
    const existing = Array.from({ length: 10 }, (_, index) =>
      socialLink({ id: `id-${index}`, platform: "OTHER", url: `https://x${index}.com` }),
    );
    const { service } = buildService({ listByUserId: existing });

    await expect(
      service.create(USER_ID, { platform: "WEBSITE", url: "https://new.com" }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("throws ConflictError when the non-OTHER platform is already linked", async () => {
    const { service } = buildService({
      listByUserId: [socialLink({ platform: "INSTAGRAM" })],
    });

    await expect(
      service.create(USER_ID, { platform: "INSTAGRAM", username: "another" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("allows a second OTHER link without a conflict", async () => {
    const { repository, service } = buildService({
      listByUserId: [socialLink({ platform: "OTHER", url: "https://first.com" })],
    });

    await service.create(USER_ID, { platform: "OTHER", url: "https://second.com" });

    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  it("throws ConflictError when the url is already added", async () => {
    const { service } = buildService({
      listByUserId: [socialLink({ platform: "WEBSITE", url: "https://reader.com" })],
    });

    await expect(
      service.create(USER_ID, { platform: "OTHER", url: "https://reader.com" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("SocialLinkService.update", () => {
  it("throws NotFoundError when the link does not exist", async () => {
    const { service } = buildService({ findById: null });

    await expect(service.update(USER_ID, LINK_ID, { username: "renamed" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("throws NotFoundError when the link belongs to another user", async () => {
    const { service } = buildService({ findById: socialLink({ userId: OTHER_USER_ID }) });

    await expect(service.update(USER_ID, LINK_ID, { username: "renamed" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("throws BadRequestError when the result would have neither username nor url", async () => {
    const { service } = buildService({
      findById: socialLink({ url: null, username: "reader" }),
    });

    await expect(service.update(USER_ID, LINK_ID, { username: null })).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  it("throws ConflictError when changing to a non-OTHER platform the user already holds", async () => {
    const { service } = buildService({
      findById: socialLink({ id: LINK_ID, platform: "WEBSITE", url: "https://reader.com" }),
      listByUserId: [
        socialLink({ id: LINK_ID, platform: "WEBSITE", url: "https://reader.com" }),
        socialLink({ id: "other-id", platform: "INSTAGRAM", username: "reader" }),
      ],
    });

    await expect(
      service.update(USER_ID, LINK_ID, { platform: "INSTAGRAM" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws ConflictError when changing to a url the user already has on another link", async () => {
    const { service } = buildService({
      findById: socialLink({ id: LINK_ID, platform: "OTHER", url: "https://a.com" }),
      listByUserId: [
        socialLink({ id: LINK_ID, platform: "OTHER", url: "https://a.com" }),
        socialLink({ id: "other-id", platform: "WEBSITE", url: "https://taken.com" }),
      ],
    });

    await expect(
      service.update(USER_ID, LINK_ID, { url: "https://taken.com" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("persists only the present keys, keeping undefined and clearing null", async () => {
    const { repository, service } = buildService({
      findById: socialLink({ url: "https://reader.com", username: "reader" }),
      listByUserId: [socialLink({ url: "https://reader.com", username: "reader" })],
    });
    const input: UpdateSocialLinkInput = { label: "Books", username: null };

    await service.update(USER_ID, LINK_ID, input);

    const [id, data] = repository.update.mock.calls[0] as [
      string,
      Prisma.UserSocialLinkUpdateInput,
    ];
    expect(id).toBe(LINK_ID);
    expect(data).toEqual({ label: "Books", username: null });
    expect(data).not.toHaveProperty("url");
    expect(data).not.toHaveProperty("platform");
  });

  it("returns the mapped view of the updated row", async () => {
    const updated = socialLink({ label: "Books", username: "renamed" });
    const { service } = buildService({
      findById: socialLink({ username: "reader" }),
      listByUserId: [socialLink({ username: "reader" })],
      update: updated,
    });

    const view = await service.update(USER_ID, LINK_ID, { username: "renamed" });

    expect(view.username).toBe("renamed");
    expect(view.label).toBe("Books");
  });
});

describe("SocialLinkService.delete", () => {
  it("throws NotFoundError when the link does not exist", async () => {
    const { service } = buildService({ findById: null });

    await expect(service.delete(USER_ID, LINK_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError when the link belongs to another user", async () => {
    const { service } = buildService({ findById: socialLink({ userId: OTHER_USER_ID }) });

    await expect(service.delete(USER_ID, LINK_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("calls deleteById on the happy path", async () => {
    const { repository, service } = buildService({ findById: socialLink({ userId: USER_ID }) });

    await service.delete(USER_ID, LINK_ID);

    expect(repository.deleteById).toHaveBeenCalledWith(LINK_ID);
  });
});
