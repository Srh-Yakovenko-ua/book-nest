import type { ReadingStatisticsDiscoveriesSection } from "@app/shared";

import { QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";
import { createTestQueryClient, render, renderWithProviders, screen } from "@/test-utils";

import { overviewFixture } from "../../model/statistics.fixtures";
import { DiscoveriesSection } from "./discoveries-section";

const { discoveries } = overviewFixture();

function withUnratedAuthorReads(count: number): ReadingStatisticsDiscoveriesSection {
  if (discoveries.author === null) throw new Error("fixture must expose an author discovery");
  return {
    ...discoveries,
    author: { ...discoveries.author, averageRating: null, completedReadsAfterDiscovery: count },
  };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes("/api/genres")) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          }),
        );
      }
      return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DiscoveriesSection", () => {
  it.each([
    { count: 1, text: "1 читання за період (включно з першим)" },
    { count: 2, text: "2 читання за період (включно з першим)" },
    { count: 5, text: "5 читань за період (включно з першим)" },
  ])("counts $count period read(s) including the first one in uk", ({ count, text }) => {
    renderWithProviders(<DiscoveriesSection discoveries={withUnratedAuthorReads(count)} />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it.each([
    { count: 1, text: "1 read in this period (including the first)" },
    { count: 2, text: "2 reads in this period (including the first)" },
  ])("counts $count period read(s) including the first one in en", ({ count, text }) => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <QueryClientProvider client={createTestQueryClient()}>
          <DiscoveriesSection discoveries={withUnratedAuthorReads(count)} />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("keeps the average rating beside the period count", () => {
    renderWithProviders(<DiscoveriesSection discoveries={discoveries} />);

    expect(
      screen.getByText("2 читання за період (включно з першим) · середня оцінка 9,0"),
    ).toBeInTheDocument();
  });

  it("keeps the discovered author unclickable even though its reads form an exact subset", () => {
    renderWithProviders(<DiscoveriesSection discoveries={discoveries} />);

    const discoveredName = screen.getByText("Урсула Ле Ґуїн");
    expect(discoveredName.closest("button")).toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
