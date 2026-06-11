import { afterEach, describe, expect, it, vi } from "vitest";

import { WikidataClient } from "./wikidata.client.js";

type Binding = {
  birth?: { value: string };
  death?: { value: string };
  iso?: { value: string };
};

function bindingsResponse(bindings: Binding[], ok = true, status = 200): Response {
  return jsonResponse({ results: { bindings } }, ok, status);
}

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

describe("WikidataClient.getAuthorFactsByQid", () => {
  it("maps the country iso code, birth year and death year from a binding", async () => {
    mockFetch(
      Promise.resolve(
        bindingsResponse([
          {
            birth: { value: "1903-06-25T00:00:00Z" },
            death: { value: "1950-01-21T00:00:00Z" },
            iso: { value: "GB" },
          },
        ]),
      ),
    );

    const facts = await new WikidataClient().getAuthorFactsByQid("Q3335");

    expect(facts).toEqual({ birthYear: 1903, countryCode: "GB", deathYear: 1950 });
  });

  it("upper-cases and trims the country iso code", async () => {
    mockFetch(Promise.resolve(bindingsResponse([{ iso: { value: "  ua " } }])));

    const facts = await new WikidataClient().getAuthorFactsByQid("Q42");

    expect(facts?.countryCode).toBe("UA");
  });

  it("returns null facts when the binding fields are absent", async () => {
    mockFetch(Promise.resolve(bindingsResponse([{}])));

    const facts = await new WikidataClient().getAuthorFactsByQid("Q42");

    expect(facts).toEqual({ birthYear: null, countryCode: null, deathYear: null });
  });

  it("returns null facts when there are no bindings", async () => {
    mockFetch(Promise.resolve(bindingsResponse([])));

    const facts = await new WikidataClient().getAuthorFactsByQid("Q42");

    expect(facts).toEqual({ birthYear: null, countryCode: null, deathYear: null });
  });

  it("parses a negative birth year for a BCE date", async () => {
    mockFetch(Promise.resolve(bindingsResponse([{ birth: { value: "-0427-01-01T00:00:00Z" } }])));

    const facts = await new WikidataClient().getAuthorFactsByQid("Q859");

    expect(facts?.birthYear).toBe(-427);
  });

  it("returns null without fetching when the qid is malformed", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const facts = await new WikidataClient().getAuthorFactsByQid("not-a-qid");

    expect(facts).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns null when the response is not ok", async () => {
    mockFetch(Promise.resolve(bindingsResponse([], false, 500)));

    const facts = await new WikidataClient().getAuthorFactsByQid("Q3335");

    expect(facts).toBeNull();
  });

  it("returns null when the body has an unexpected shape", async () => {
    mockFetch(Promise.resolve(jsonResponse({ unexpected: true })));

    const facts = await new WikidataClient().getAuthorFactsByQid("Q3335");

    expect(facts).toBeNull();
  });

  it("returns null when the fetch call rejects", async () => {
    mockFetch(Promise.reject(new Error("timeout")));

    const facts = await new WikidataClient().getAuthorFactsByQid("Q3335");

    expect(facts).toBeNull();
  });

  it("queries the sparql endpoint with the P27, P569 and P570 properties for the qid", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(bindingsResponse([{}]));

    await new WikidataClient().getAuthorFactsByQid("Q3335");

    const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("https://query.wikidata.org/sparql");
    expect(calledUrl).toContain("format=json");
    const decoded = decodeURIComponent(calledUrl);
    expect(decoded).toContain("wd:Q3335");
    expect(decoded).toContain("wdt:P27");
    expect(decoded).toContain("wdt:P297");
    expect(decoded).toContain("wdt:P569");
    expect(decoded).toContain("wdt:P570");
  });
});
