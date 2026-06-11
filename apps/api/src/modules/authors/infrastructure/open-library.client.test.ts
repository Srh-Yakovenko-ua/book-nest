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
