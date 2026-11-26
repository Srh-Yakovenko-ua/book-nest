import type { ProfileView } from "@app/shared";

export function makeProfile(overrides: Partial<ProfileView> = {}): ProfileView {
  return {
    authProvider: "PASSWORD",
    avatarUrl: null,
    bio: "Reads fantasy at night.",
    createdAt: "2026-01-01T00:00:00.000Z",
    dateOfBirth: null,
    email: "olena@book.nest",
    emailVerified: true,
    favoriteBookQuote: null,
    favoriteGenres: [],
    lastName: null,
    name: "Olena Petrenko",
    nickname: "olena_reads",
    socialLinks: [],
    updatedAt: "2026-01-01T00:00:00.000Z",
    userId: "3f9b1c2d-4e5a-4b6c-8d7e-9f0a1b2c3d4e",
    ...overrides,
  };
}
