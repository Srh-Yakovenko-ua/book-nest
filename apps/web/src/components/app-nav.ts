import type { LucideIcon } from "lucide-react";

import {
  BookCopy,
  BookOpenCheck,
  Building2,
  ChartColumnBig,
  Feather,
  Handshake,
  Heart,
  House,
  LibraryBig,
  ListChecks,
  ListOrdered,
  NotebookPen,
  Quote,
  Settings,
  Shapes,
  ShoppingBag,
  Tags,
  Truck,
  UsersRound,
} from "lucide-react";

export type NavItem = NavLink | NavSection;

export type NavLink = {
  icon: LucideIcon;
  kind: "link";
  labelKey: NavMessageKey;
  match: "exact" | "prefix";
  to: string;
};

export type NavSection = {
  children: readonly [NavSectionChild, ...NavSectionChild[]];
  icon: LucideIcon;
  kind: "section";
  labelKey: NavMessageKey;
  pathPrefix: string;
  subListLabelKey: NavMessageKey;
};

export type NavSectionChild = {
  labelKey: NavMessageKey;
  to: string;
};

type NavGroup = {
  items: readonly [NavItem, ...NavItem[]];
  labelKey: NavGroupMessageKey;
};

type NavGroupMessageKey =
  "nav.groups.books" | "nav.groups.catalog" | "nav.groups.records" | "nav.groups.tracking";

type NavMessageKey =
  | "delivery.subnav.history"
  | "delivery.subnav.inTransit"
  | "delivery.subnav.label"
  | "delivery.subnav.statistics"
  | "nav.allBooks"
  | "nav.buyList"
  | "nav.characters"
  | "nav.dedications"
  | "nav.delivery"
  | "nav.favorites"
  | "nav.genres"
  | "nav.home"
  | "nav.lists"
  | "nav.loans"
  | "nav.loansBorrowed"
  | "nav.loansContacts"
  | "nav.loansHistory"
  | "nav.loansLent"
  | "nav.myLibrary"
  | "nav.notes"
  | "nav.notesBooks"
  | "nav.notesSeries"
  | "nav.publishers"
  | "nav.quotes"
  | "nav.readingQueue"
  | "nav.series"
  | "nav.settings"
  | "nav.statistics"
  | "nav.tags";

export const APP_NAV = {
  groups: [
    {
      items: [
        {
          icon: BookOpenCheck,
          kind: "link",
          labelKey: "nav.myLibrary",
          match: "prefix",
          to: "/my-library",
        },
        { icon: LibraryBig, kind: "link", labelKey: "nav.allBooks", match: "prefix", to: "/books" },
        { icon: Heart, kind: "link", labelKey: "nav.favorites", match: "prefix", to: "/favorites" },
        {
          icon: ListOrdered,
          kind: "link",
          labelKey: "nav.readingQueue",
          match: "prefix",
          to: "/reading-queue",
        },
        {
          icon: ShoppingBag,
          kind: "link",
          labelKey: "nav.buyList",
          match: "prefix",
          to: "/books-to-buy",
        },
        { icon: ListChecks, kind: "link", labelKey: "nav.lists", match: "prefix", to: "/lists" },
      ],
      labelKey: "nav.groups.books",
    },
    {
      items: [
        { icon: BookCopy, kind: "link", labelKey: "nav.series", match: "prefix", to: "/series" },
        {
          icon: UsersRound,
          kind: "link",
          labelKey: "nav.characters",
          match: "prefix",
          to: "/characters",
        },
        {
          icon: Building2,
          kind: "link",
          labelKey: "nav.publishers",
          match: "prefix",
          to: "/publishers",
        },
        { icon: Shapes, kind: "link", labelKey: "nav.genres", match: "prefix", to: "/genres" },
        { icon: Tags, kind: "link", labelKey: "nav.tags", match: "prefix", to: "/tags" },
      ],
      labelKey: "nav.groups.catalog",
    },
    {
      items: [
        { icon: Quote, kind: "link", labelKey: "nav.quotes", match: "prefix", to: "/quotes" },
        {
          icon: Feather,
          kind: "link",
          labelKey: "nav.dedications",
          match: "prefix",
          to: "/dedications",
        },
        {
          children: [
            { labelKey: "nav.notesBooks", to: "/notes/books" },
            { labelKey: "nav.notesSeries", to: "/notes/series" },
          ],
          icon: NotebookPen,
          kind: "section",
          labelKey: "nav.notes",
          pathPrefix: "/notes",
          subListLabelKey: "nav.notes",
        },
      ],
      labelKey: "nav.groups.records",
    },
    {
      items: [
        {
          children: [
            { labelKey: "nav.loansBorrowed", to: "/loans/borrowed" },
            { labelKey: "nav.loansLent", to: "/loans/lent" },
            { labelKey: "nav.loansHistory", to: "/loans/history" },
            { labelKey: "nav.loansContacts", to: "/loans/contacts" },
          ],
          icon: Handshake,
          kind: "section",
          labelKey: "nav.loans",
          pathPrefix: "/loans",
          subListLabelKey: "nav.loans",
        },
        {
          children: [
            { labelKey: "delivery.subnav.inTransit", to: "/delivery/in-transit" },
            { labelKey: "delivery.subnav.history", to: "/delivery/history" },
            { labelKey: "delivery.subnav.statistics", to: "/delivery/statistics" },
          ],
          icon: Truck,
          kind: "section",
          labelKey: "nav.delivery",
          pathPrefix: "/delivery",
          subListLabelKey: "delivery.subnav.label",
        },
        {
          icon: ChartColumnBig,
          kind: "link",
          labelKey: "nav.statistics",
          match: "prefix",
          to: "/statistics",
        },
      ],
      labelKey: "nav.groups.tracking",
    },
  ],
  home: { icon: House, kind: "link", labelKey: "nav.home", match: "exact", to: "/" },
  settings: {
    icon: Settings,
    kind: "link",
    labelKey: "nav.settings",
    match: "prefix",
    to: "/settings",
  },
} satisfies { groups: readonly [NavGroup, ...NavGroup[]]; home: NavLink; settings: NavLink };

export function isNavChildActive(child: NavSectionChild, pathname: string): boolean {
  return isPathWithin(child.to, pathname);
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.kind === "section") return isPathWithin(item.pathPrefix, pathname);
  if (item.match === "exact") return pathname === item.to;
  return isPathWithin(item.to, pathname);
}

function isPathWithin(base: string, pathname: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}
