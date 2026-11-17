import type { MouseEvent } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { type LinkDestination, useLinkLeaveGuard } from "./use-link-leave-guard";

type LinkSpec = {
  download?: boolean;
  href: string;
  name: string;
  target?: string;
};

const CURRENT_PAGE = "/uk/characters/c1/edit";

const LINKS = {
  books: { href: "/uk/books", name: "Books" },
  booksWithQuery: { href: "/uk/books?x=1#top", name: "Books" },
  englishSeries: { href: "/en/series/s1", name: "Series" },
} as const satisfies Record<string, LinkSpec>;

const MODIFIER_KEYS = ["Control", "Meta", "Shift", "Alt"] as const;

const onLeaveAttempt = vi.fn<(destination: LinkDestination) => void>();

const browserNavigation = vi.fn<(name: string) => void>();

async function clickLink(link: LinkSpec) {
  await userEvent.click(screen.getByRole("link", { name: link.name }));
}

function GuardedLink({ isGuarding, link }: { isGuarding: boolean; link: LinkSpec }) {
  useLinkLeaveGuard({ isGuarding, onLeaveAttempt });

  return (
    <a
      download={link.download}
      href={link.href}
      onClick={navigateInsteadOfBrowser(link.name)}
      target={link.target}
    >
      {link.name}
    </a>
  );
}

function navigateInsteadOfBrowser(name: string) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (!event.nativeEvent.defaultPrevented) browserNavigation(name);
    event.preventDefault();
  };
}

beforeEach(() => {
  window.history.replaceState(null, "", CURRENT_PAGE);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useLinkLeaveGuard", () => {
  it("hands an in-app link click to the caller and prevents the navigation", async () => {
    renderWithProviders(<GuardedLink isGuarding link={LINKS.booksWithQuery} />);

    await clickLink(LINKS.booksWithQuery);

    expect(onLeaveAttempt).toHaveBeenCalledExactlyOnceWith({
      href: "/books?x=1#top",
      locale: "uk",
    });
    expect(browserNavigation).not.toHaveBeenCalled();
  });

  it("reports the locale the link points to rather than the current one", async () => {
    renderWithProviders(<GuardedLink isGuarding link={LINKS.englishSeries} />);

    await clickLink(LINKS.englishSeries);

    expect(onLeaveAttempt).toHaveBeenCalledExactlyOnceWith({ href: "/series/s1", locale: "en" });
  });

  it("lets the click through when not guarding", async () => {
    renderWithProviders(<GuardedLink isGuarding={false} link={LINKS.books} />);

    await clickLink(LINKS.books);

    expect(onLeaveAttempt).not.toHaveBeenCalled();
    expect(browserNavigation).toHaveBeenCalledExactlyOnceWith(LINKS.books.name);
  });

  it("stops intercepting once the guard turns off", async () => {
    const { rerender } = renderWithProviders(<GuardedLink isGuarding link={LINKS.books} />);

    rerender(<GuardedLink isGuarding={false} link={LINKS.books} />);
    await clickLink(LINKS.books);

    expect(onLeaveAttempt).not.toHaveBeenCalled();
    expect(browserNavigation).toHaveBeenCalledExactlyOnceWith(LINKS.books.name);
  });

  describe("ignores modified clicks, new-tab and download links", () => {
    it.each(MODIFIER_KEYS)("leaves a %s-click to the browser", async (modifier) => {
      const user = userEvent.setup();
      renderWithProviders(<GuardedLink isGuarding link={LINKS.books} />);

      await user.keyboard(`{${modifier}>}`);
      await user.click(screen.getByRole("link", { name: LINKS.books.name }));
      await user.keyboard(`{/${modifier}}`);

      expect(onLeaveAttempt).not.toHaveBeenCalled();
      expect(browserNavigation).toHaveBeenCalledExactlyOnceWith(LINKS.books.name);
    });

    it.each([
      { case: "a new-tab link", link: { ...LINKS.books, target: "_blank" } },
      { case: "a download link", link: { ...LINKS.books, download: true } },
    ])("leaves $case to the browser", async ({ link }) => {
      renderWithProviders(<GuardedLink isGuarding link={link} />);

      await clickLink(link);

      expect(onLeaveAttempt).not.toHaveBeenCalled();
      expect(browserNavigation).toHaveBeenCalledExactlyOnceWith(link.name);
    });
  });

  describe("ignores hash-only and same-page links", () => {
    it.each([
      { case: "a hash-only link", link: { href: "#aliases", name: "Aliases" } },
      { case: "a link to the current page", link: { href: CURRENT_PAGE, name: "Edit" } },
      {
        case: "a link to a section of the current page",
        link: { href: `${CURRENT_PAGE}#aliases`, name: "Aliases" },
      },
    ])("leaves $case to the browser", async ({ link }) => {
      renderWithProviders(<GuardedLink isGuarding link={link} />);

      await clickLink(link);

      expect(onLeaveAttempt).not.toHaveBeenCalled();
      expect(browserNavigation).toHaveBeenCalledExactlyOnceWith(link.name);
    });
  });

  describe("ignores other origins and paths without a locale", () => {
    it.each([
      {
        case: "a link to another origin",
        link: { href: "https://example.com/uk/books", name: "Elsewhere" },
      },
      { case: "a path without a locale", link: { href: "/books", name: "Books" } },
      { case: "a path under an unsupported locale", link: { href: "/de/books", name: "Books" } },
    ])("leaves $case to the browser", async ({ link }) => {
      renderWithProviders(<GuardedLink isGuarding link={link} />);

      await clickLink(link);

      expect(onLeaveAttempt).not.toHaveBeenCalled();
      expect(browserNavigation).toHaveBeenCalledExactlyOnceWith(link.name);
    });
  });
});
