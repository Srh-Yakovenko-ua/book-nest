import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenLibraryClient } from "./open-library.client.js";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    json: () => Promise.resolve(body),
    ok,
    status,
  } as unknown as Response;
}

function mockFetch(response: Promise<Response>): void {
  vi.spyOn(globalThis, "fetch").mockReturnValue(response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OpenLibraryClient.searchAuthors", () => {
  it("maps the docs of a successful response into author candidates", async () => {
    mockFetch(
      Promise.resolve(
        jsonResponse({
          docs: [
            { birth_date: "25 June 1903", key: "OL23919A", name: "George Orwell" },
            { birth_date: "1920", key: "OL34221A", name: "Isaac Asimov" },
          ],
        }),
      ),
    );

    const result = await new OpenLibraryClient().searchAuthors("orwell");

    expect(result).toEqual([
      {
        birthYear: 1903,
        key: "OL23919A",
        name: "George Orwell",
        photoUrl: "https://covers.openlibrary.org/a/olid/OL23919A-M.jpg",
      },
      {
        birthYear: 1920,
        key: "OL34221A",
        name: "Isaac Asimov",
        photoUrl: "https://covers.openlibrary.org/a/olid/OL34221A-M.jpg",
      },
    ]);
  });

  it("builds the photo url from the open library id", async () => {
    mockFetch(Promise.resolve(jsonResponse({ docs: [{ key: "OL99A", name: "Some Author" }] })));

    const [author] = await new OpenLibraryClient().searchAuthors("some");

    expect(author?.photoUrl).toBe("https://covers.openlibrary.org/a/olid/OL99A-M.jpg");
  });

  it("returns a null birth year when the doc has no birth date", async () => {
    mockFetch(Promise.resolve(jsonResponse({ docs: [{ key: "OL5A", name: "No Birthday" }] })));

    const [author] = await new OpenLibraryClient().searchAuthors("no");

    expect(author?.birthYear).toBeNull();
  });

  it("skips docs whose name is missing", async () => {
    mockFetch(
      Promise.resolve(
        jsonResponse({
          docs: [{ key: "OL1A" }, { key: "OL2A", name: "Named" }],
        }),
      ),
    );

    const result = await new OpenLibraryClient().searchAuthors("named");

    expect(result.map((author) => author.key)).toEqual(["OL2A"]);
  });

  it("skips docs whose name is only whitespace", async () => {
    mockFetch(Promise.resolve(jsonResponse({ docs: [{ key: "OL1A", name: "   " }] })));

    const result = await new OpenLibraryClient().searchAuthors("blank");

    expect(result).toEqual([]);
  });

  it("caps the number of returned candidates at ten", async () => {
    const docs = Array.from({ length: 15 }, (_, index) => ({
      key: `OL${String(index)}A`,
      name: `Author ${String(index)}`,
    }));
    mockFetch(Promise.resolve(jsonResponse({ docs })));

    const result = await new OpenLibraryClient().searchAuthors("author");

    expect(result).toHaveLength(10);
  });

  it("returns an empty array when the response is not ok", async () => {
    mockFetch(Promise.resolve(jsonResponse({ docs: [] }, false, 503)));

    const result = await new OpenLibraryClient().searchAuthors("orwell");

    expect(result).toEqual([]);
  });

  it("returns an empty array when the body has an unexpected shape", async () => {
    mockFetch(Promise.resolve(jsonResponse({ unexpected: true })));

    const result = await new OpenLibraryClient().searchAuthors("orwell");

    expect(result).toEqual([]);
  });

  it("returns an empty array when the fetch call rejects", async () => {
    mockFetch(Promise.reject(new Error("network down")));

    const result = await new OpenLibraryClient().searchAuthors("orwell");

    expect(result).toEqual([]);
  });

  it("requests the open library authors search endpoint with the query", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ docs: [] }));

    await new OpenLibraryClient().searchAuthors("dostoevsky");

    const calledUrl = fetchSpy.mock.calls[0]?.[0];
    expect(String(calledUrl)).toBe(
      "https://openlibrary.org/search/authors.json?q=dostoevsky&limit=10",
    );
  });
});

describe("OpenLibraryClient.getAuthorByKey", () => {
  it("normalizes a plain string bio by trimming it", async () => {
    mockFetch(Promise.resolve(jsonResponse({ bio: "  An English novelist.  ", name: "Orwell" })));

    const detail = await new OpenLibraryClient().getAuthorByKey("OL23919A");

    expect(detail?.bio).toBe("An English novelist.");
  });

  it("normalizes an object bio by reading its value field", async () => {
    mockFetch(
      Promise.resolve(jsonResponse({ bio: { value: "A Russian author." }, name: "Dostoevsky" })),
    );

    const detail = await new OpenLibraryClient().getAuthorByKey("OL22242A");

    expect(detail?.bio).toBe("A Russian author.");
  });

  it("returns a null bio when the bio is absent", async () => {
    mockFetch(Promise.resolve(jsonResponse({ name: "No Bio Author" })));

    const detail = await new OpenLibraryClient().getAuthorByKey("OL1A");

    expect(detail?.bio).toBeNull();
  });

  it("returns a null bio when an object bio value is only whitespace", async () => {
    mockFetch(Promise.resolve(jsonResponse({ bio: { value: "   " }, name: "Blank Bio" })));

    const detail = await new OpenLibraryClient().getAuthorByKey("OL2A");

    expect(detail?.bio).toBeNull();
  });

  it("builds the photo url from the first photo id", async () => {
    mockFetch(Promise.resolve(jsonResponse({ name: "Pictured", photos: [12345, 999] })));

    const detail = await new OpenLibraryClient().getAuthorByKey("OL3A");

    expect(detail?.photoUrl).toBe("https://covers.openlibrary.org/a/id/12345-L.jpg");
  });

  it("returns a null photo url when the first photo id is the missing sentinel", async () => {
    mockFetch(Promise.resolve(jsonResponse({ name: "Sentinel", photos: [-1] })));

    const detail = await new OpenLibraryClient().getAuthorByKey("OL4A");

    expect(detail?.photoUrl).toBeNull();
  });

  it("returns a null photo url when the photos array is missing", async () => {
    mockFetch(Promise.resolve(jsonResponse({ name: "No Photos" })));

    const detail = await new OpenLibraryClient().getAuthorByKey("OL5A");

    expect(detail?.photoUrl).toBeNull();
  });

  it("extracts the birth year from a free-text birth date", async () => {
    mockFetch(Promise.resolve(jsonResponse({ birth_date: "31 July 1965", name: "Rowling" })));

    const detail = await new OpenLibraryClient().getAuthorByKey("OL6A");

    expect(detail?.birthYear).toBe(1965);
  });

  it("returns a null birth year when the birth date has no four-digit year", async () => {
    mockFetch(Promise.resolve(jsonResponse({ birth_date: "spring", name: "Vague" })));

    const detail = await new OpenLibraryClient().getAuthorByKey("OL7A");

    expect(detail?.birthYear).toBeNull();
  });

  it("extracts the wikidata id from remote ids", async () => {
    mockFetch(Promise.resolve(jsonResponse({ name: "Linked", remote_ids: { wikidata: "Q3335" } })));

    const detail = await new OpenLibraryClient().getAuthorByKey("OL8A");

    expect(detail?.wikidataId).toBe("Q3335");
  });

  it("returns a null wikidata id when remote ids are absent", async () => {
    mockFetch(Promise.resolve(jsonResponse({ name: "Unlinked" })));

    const detail = await new OpenLibraryClient().getAuthorByKey("OL9A");

    expect(detail?.wikidataId).toBeNull();
  });

  it("returns null when the author has no name", async () => {
    mockFetch(Promise.resolve(jsonResponse({ bio: "orphaned" })));

    const detail = await new OpenLibraryClient().getAuthorByKey("OL10A");

    expect(detail).toBeNull();
  });

  it("returns null when the response is not ok", async () => {
    mockFetch(Promise.resolve(jsonResponse({ name: "Ignored" }, false, 404)));

    const detail = await new OpenLibraryClient().getAuthorByKey("OL11A");

    expect(detail).toBeNull();
  });

  it("returns null when the body has an unexpected shape", async () => {
    mockFetch(Promise.resolve(jsonResponse({ photos: "not-an-array" })));

    const detail = await new OpenLibraryClient().getAuthorByKey("OL12A");

    expect(detail).toBeNull();
  });

  it("returns null when the fetch call rejects", async () => {
    mockFetch(Promise.reject(new Error("network down")));

    const detail = await new OpenLibraryClient().getAuthorByKey("OL13A");

    expect(detail).toBeNull();
  });

  it("requests the author-by-key endpoint for the given olid", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ name: "Whoever" }));

    await new OpenLibraryClient().getAuthorByKey("OL23919A");

    const calledUrl = fetchSpy.mock.calls[0]?.[0];
    expect(String(calledUrl)).toBe("https://openlibrary.org/authors/OL23919A.json");
  });
});

describe("OpenLibraryClient.getWorksByAuthor", () => {
  it("maps work entries into suggestions with a cover url and stripped work key", async () => {
    mockFetch(
      Promise.resolve(
        jsonResponse({
          entries: [{ covers: [42], first_publish_year: 1949, key: "/works/OL1W", title: "1984" }],
        }),
      ),
    );

    const works = await new OpenLibraryClient().getWorksByAuthor("OL23919A");

    expect(works).toEqual([
      {
        coverUrl: "https://covers.openlibrary.org/b/id/42-M.jpg",
        firstPublishYear: 1949,
        openLibraryWorkKey: "OL1W",
        title: "1984",
      },
    ]);
  });

  it("returns a null cover url when no usable cover id is present", async () => {
    mockFetch(
      Promise.resolve(
        jsonResponse({ entries: [{ covers: [-1], key: "/works/OL2W", title: "X" }] }),
      ),
    );

    const [work] = await new OpenLibraryClient().getWorksByAuthor("OL2A");

    expect(work?.coverUrl).toBeNull();
  });

  it("skips entries whose title is missing or blank", async () => {
    mockFetch(
      Promise.resolve(
        jsonResponse({
          entries: [
            { key: "/works/OL1W" },
            { key: "/works/OL2W", title: "   " },
            { key: "/works/OL3W", title: "Kept" },
          ],
        }),
      ),
    );

    const works = await new OpenLibraryClient().getWorksByAuthor("OL3A");

    expect(works.map((work) => work.openLibraryWorkKey)).toEqual(["OL3W"]);
  });

  it("returns an empty array when the response is not ok", async () => {
    mockFetch(Promise.resolve(jsonResponse({ entries: [] }, false, 502)));

    const works = await new OpenLibraryClient().getWorksByAuthor("OL4A");

    expect(works).toEqual([]);
  });

  it("returns an empty array when the body has an unexpected shape", async () => {
    mockFetch(Promise.resolve(jsonResponse({ unexpected: true })));

    const works = await new OpenLibraryClient().getWorksByAuthor("OL5A");

    expect(works).toEqual([]);
  });

  it("returns an empty array when the fetch call rejects", async () => {
    mockFetch(Promise.reject(new Error("timeout")));

    const works = await new OpenLibraryClient().getWorksByAuthor("OL6A");

    expect(works).toEqual([]);
  });

  it("requests the works endpoint with a limit for the given olid", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ entries: [] }));

    await new OpenLibraryClient().getWorksByAuthor("OL23919A");

    const calledUrl = fetchSpy.mock.calls[0]?.[0];
    expect(String(calledUrl)).toBe("https://openlibrary.org/authors/OL23919A/works.json?limit=50");
  });
});
