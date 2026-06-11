import { describe, expect, it, vi } from "vitest";

import type { AuthorsRepository } from "../infrastructure/authors.repository.js";
import type {
  OpenLibraryAuthor,
  OpenLibraryClient,
} from "../infrastructure/open-library.client.js";

import { AuthorsService } from "./authors.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

type LookupMatch = { normalizedName: string; openLibraryKey: null | string };

function buildService(overrides: { candidates?: OpenLibraryAuthor[]; matches?: LookupMatch[] }): {
  findExistingByLookup: ReturnType<typeof vi.fn>;
  searchAuthors: ReturnType<typeof vi.fn>;
  service: AuthorsService;
} {
  const searchAuthors = vi.fn().mockResolvedValue(overrides.candidates ?? []);
  const findExistingByLookup = vi.fn().mockResolvedValue(overrides.matches ?? []);

  const repository = { findExistingByLookup } as unknown as AuthorsRepository;
  const openLibraryClient = { searchAuthors } as unknown as OpenLibraryClient;

  const service = new AuthorsService(repository, openLibraryClient);

  return { findExistingByLookup, searchAuthors, service };
}

function candidate(overrides: Partial<OpenLibraryAuthor> = {}): OpenLibraryAuthor {
  return {
    birthYear: 1903,
    key: "OL23919A",
    name: "George Orwell",
    photoUrl: "https://covers.openlibrary.org/a/olid/OL23919A-M.jpg",
    ...overrides,
  };
}

describe("AuthorsService.lookup", () => {
  it("returns an empty array without querying the repository when there are no candidates", async () => {
    const { findExistingByLookup, service } = buildService({ candidates: [] });

    const result = await service.lookup(USER_ID, "orwell");

    expect(result).toEqual([]);
    expect(findExistingByLookup).not.toHaveBeenCalled();
  });

  it("shapes each candidate into an open library lookup result", async () => {
    const { service } = buildService({ candidates: [candidate()] });

    const result = await service.lookup(USER_ID, "orwell");

    expect(result).toEqual([
      {
        birthYear: 1903,
        inDb: false,
        name: "George Orwell",
        openLibraryKey: "OL23919A",
        photoUrl: "https://covers.openlibrary.org/a/olid/OL23919A-M.jpg",
        source: "open_library",
      },
    ]);
  });

  it("marks inDb true when a stored author matches by open library key", async () => {
    const { service } = buildService({
      candidates: [candidate({ key: "OL23919A", name: "George Orwell" })],
      matches: [{ normalizedName: "different name", openLibraryKey: "OL23919A" }],
    });

    const [result] = await service.lookup(USER_ID, "orwell");

    expect(result?.inDb).toBe(true);
  });

  it("marks inDb true when a stored author matches by normalized name", async () => {
    const { service } = buildService({
      candidates: [candidate({ key: "OL23919A", name: "George Orwell" })],
      matches: [{ normalizedName: "george orwell", openLibraryKey: null }],
    });

    const [result] = await service.lookup(USER_ID, "orwell");

    expect(result?.inDb).toBe(true);
  });

  it("marks inDb false when no stored author matches the candidate", async () => {
    const { service } = buildService({
      candidates: [candidate({ key: "OL23919A", name: "George Orwell" })],
      matches: [{ normalizedName: "isaac asimov", openLibraryKey: "OL34221A" }],
    });

    const [result] = await service.lookup(USER_ID, "orwell");

    expect(result?.inDb).toBe(false);
  });

  it("flags only the candidates that match across a mixed batch", async () => {
    const { service } = buildService({
      candidates: [
        candidate({ key: "OL1A", name: "Matched By Key" }),
        candidate({ key: "OL2A", name: "Matched By Name" }),
        candidate({ key: "OL3A", name: "Unmatched Author" }),
      ],
      matches: [
        { normalizedName: "anything", openLibraryKey: "OL1A" },
        { normalizedName: "matched by name", openLibraryKey: null },
      ],
    });

    const result = await service.lookup(USER_ID, "matched");

    expect(result.map((entry) => entry.inDb)).toEqual([true, true, false]);
  });

  it("queries the repository with the candidates' keys and normalized names scoped to the user", async () => {
    const { findExistingByLookup, service } = buildService({
      candidates: [candidate({ key: "OL1A", name: "George Orwell" })],
    });

    await service.lookup(USER_ID, "orwell");

    expect(findExistingByLookup).toHaveBeenCalledWith({
      normalizedNames: ["george orwell"],
      openLibraryKeys: ["OL1A"],
      userId: USER_ID,
    });
  });
});
