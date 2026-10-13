import { describe, expect, it } from "vitest";

import {
  APP_NAV,
  isNavChildActive,
  isNavItemActive,
  type NavItem,
  type NavSectionChild,
} from "./app-nav";

const GROUP_ITEMS: readonly NavItem[] = APP_NAV.groups.flatMap((group): NavItem[] => [
  ...group.items,
]);

const ALL_ITEMS: readonly NavItem[] = [APP_NAV.home, ...GROUP_ITEMS, APP_NAV.settings];

function childOf(pathPrefix: string, to: string): NavSectionChild {
  const section = navItem(pathPrefix);
  if (section.kind !== "section") throw new Error(`${pathPrefix} is not a section`);
  const child = section.children.find((candidate) => candidate.to === to);
  if (child === undefined) throw new Error(`no child ${to} in ${pathPrefix}`);
  return child;
}

function itemsOfGroup(labelKey: string): readonly NavItem[] {
  const group = APP_NAV.groups.find((candidate): boolean => candidate.labelKey === labelKey);
  if (group === undefined) throw new Error(`no nav group ${labelKey}`);
  return group.items;
}

function navItem(path: string): NavItem {
  const found = ALL_ITEMS.find((item) => pathOf(item) === path);
  if (found === undefined) throw new Error(`no nav item for ${path}`);
  return found;
}

function pathOf(item: NavItem): string {
  return item.kind === "section" ? item.pathPrefix : item.to;
}

describe("APP_NAV", () => {
  it("groups the catalog entries including the global characters route", () => {
    expect(itemsOfGroup("nav.groups.catalog").map(pathOf)).toEqual([
      "/series",
      "/characters",
      "/publishers",
      "/genres",
      "/tags",
    ]);
  });

  it("keeps settings out of the scrollable groups", () => {
    expect(APP_NAV.settings.to).toBe("/settings");
    expect(GROUP_ITEMS).not.toContain(APP_NAV.settings);
  });

  it("labels every group", () => {
    expect(APP_NAV.groups.map((group) => group.labelKey)).toEqual([
      "nav.groups.books",
      "nav.groups.catalog",
      "nav.groups.records",
      "nav.groups.tracking",
    ]);
  });
});

describe("isNavChildActive", () => {
  it("matches a child route and its nested routes", () => {
    const child = childOf("/loans", "/loans/history");

    expect(isNavChildActive(child, "/loans/history")).toBe(true);
    expect(isNavChildActive(child, "/loans/history/2024")).toBe(true);
    expect(isNavChildActive(child, "/loans/historical")).toBe(false);
    expect(isNavChildActive(child, "/loans/lent")).toBe(false);
  });
});

describe("isNavItemActive", () => {
  it("matches home exactly", () => {
    expect(isNavItemActive(APP_NAV.home, "/")).toBe(true);
    expect(isNavItemActive(APP_NAV.home, "/books")).toBe(false);
    expect(isNavItemActive(APP_NAV.home, "/my-library")).toBe(false);
  });

  it("leaves every other item idle on the home route", () => {
    expect(ALL_ITEMS.filter((item) => isNavItemActive(item, "/"))).toEqual([APP_NAV.home]);
  });

  it("keeps a catalog item active on its detail and edit routes", () => {
    expect(isNavItemActive(navItem("/characters"), "/characters")).toBe(true);
    expect(isNavItemActive(navItem("/characters"), "/characters/a1")).toBe(true);
    expect(isNavItemActive(navItem("/characters"), "/characters/a1/edit")).toBe(true);
    expect(isNavItemActive(navItem("/publishers"), "/publishers/p1")).toBe(true);
    expect(isNavItemActive(navItem("/series"), "/series/s1")).toBe(true);
    expect(isNavItemActive(navItem("/lists"), "/lists/l1")).toBe(true);
    expect(isNavItemActive(navItem("/books"), "/books/b1/edit")).toBe(true);
  });

  it("matches whole path segments so the wishlist never lights up all books", () => {
    expect(isNavItemActive(navItem("/books"), "/books-to-buy")).toBe(false);
    expect(isNavItemActive(navItem("/books-to-buy"), "/books-to-buy")).toBe(true);
    expect(isNavItemActive(navItem("/books-to-buy"), "/books")).toBe(false);
    expect(isNavItemActive(navItem("/series"), "/notes/series")).toBe(false);
  });

  it("keeps a section active for its own route and any child route", () => {
    expect(isNavItemActive(navItem("/loans"), "/loans")).toBe(true);
    expect(isNavItemActive(navItem("/loans"), "/loans/contacts")).toBe(true);
    expect(isNavItemActive(navItem("/delivery"), "/delivery/in-transit")).toBe(true);
    expect(isNavItemActive(navItem("/notes"), "/notes/series")).toBe(true);
    expect(isNavItemActive(navItem("/notes"), "/series")).toBe(false);
  });

  it("keeps settings active on its own route", () => {
    expect(isNavItemActive(APP_NAV.settings, "/settings")).toBe(true);
    expect(isNavItemActive(APP_NAV.settings, "/")).toBe(false);
  });
});
