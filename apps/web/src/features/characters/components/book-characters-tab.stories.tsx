import type { CharacterSummaryView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ComponentProps } from "react";

import { UpdateCharacterSchema } from "@app/shared";
import { expect, waitFor, within } from "storybook/test";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { getQueryClient } from "@/lib/query-client";

import {
  makeBookCharacterSummary,
  makeCharacterDetails,
  makeCharacterSummary,
  makeCharacterSummaryPage,
} from "../model/characters.fixtures";
import { BookCharactersTab } from "./book-characters-tab";

const ROSTER = {
  bookId: "book-1",
  cardBodyInsetPx: 12,
  characterId: "char-1",
  detailsHref: "/uk/characters/char-1?bookId=book-1",
  editHref: "/uk/characters/char-1/edit?bookId=book-1",
  name: "Ґеральт",
} as const;

const LABELS = {
  edit: "Редагувати",
  favorite: "Додати в улюблені",
  menu: "Дії з персонажем",
  unlink: "Прибрати з цієї книги",
} as const;

const LAYOUT = {
  nameTextPoint: { x: 4, y: 8 },
  narrowContainerPx: 560,
  pointerExit: { x: 1, y: 1 },
  pointerRest: { x: 1, y: 80 },
  tooltipMaxGapPx: 16,
  tooltipSettleMs: 250,
  viewport: { height: 900, width: 1024 },
} as const;

const SENTENCE_WORDS = [
  "Вартова",
  "північної",
  "брами",
  "старого",
  "Вишгорода",
  "що",
  "пам’ятає",
  "кожну",
  "зиму",
  "кожну",
  "облогу",
  "і",
  "кожне",
  "ім’я",
  "загиблих",
  "лицарів",
  "Темерії",
  "навіки",
] as const;

const LONG_NAMES = {
  displayName: "Біловолосий",
  globalName: "Ґеральт із Рівії",
  sentence: SENTENCE_WORDS.join(" "),
  sentencePrefixes: SENTENCE_WORDS.map((_, index) => SENTENCE_WORDS.slice(0, index + 1).join(" ")),
  unbrokenToken: "Вартовийбрамизабутогоміста".repeat(8).slice(0, 200),
};

const recordedNavigations: string[] = [];

const served: { roster: CharacterSummaryView[] } = { roster: [] };

type Canvas = ReturnType<typeof within>;

type MeasuredName = {
  card: HTMLElement;
  lines: number;
  name: string;
};

type RealPointer = Awaited<ReturnType<typeof loadRealPointer>>;

type RosterStoryArgs = ComponentProps<typeof BookCharactersTab> & {
  roster: CharacterSummaryView[];
};

function boxOf(element: Element) {
  const { height, left, top, width } = element.getBoundingClientRect();
  return { height, left, top, width };
}

function cardFor(canvas: Canvas, name: string): HTMLElement {
  const card = canvas.getByRole("heading", { name }).closest("li");
  if (card === null) throw new Error(`no roster card for ${name}`);
  return card;
}

async function expectNoTooltipAfterSettling() {
  await new Promise((resolve) => setTimeout(resolve, LAYOUT.tooltipSettleMs));
  await expect(within(document.body).queryByRole("tooltip")).toBeNull();
}

async function findCard(canvas: Canvas, name: string = ROSTER.name): Promise<HTMLElement> {
  await canvas.findByRole("heading", { name });
  return cardFor(canvas, name);
}

function findTooltip() {
  return within(document.body).findByRole("tooltip");
}

async function hoverCard(pointer: RealPointer, card: HTMLElement) {
  await pointer.hover(card);
  await expect(card.matches(":hover")).toBe(true);
  await Promise.all(card.getAnimations({ subtree: true }).map((animation) => animation.finished));
}

async function hoverNameText(pointer: RealPointer, card: HTMLElement, name: string) {
  await pointer.hover(within(card).getByText(name), { position: LAYOUT.nameTextPoint });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

async function loadRealPointer() {
  const { userEvent } = await import("vitest/browser");
  return userEvent;
}

async function measureName(canvas: Canvas, name: string): Promise<MeasuredName> {
  await document.fonts.ready;
  const card = cardFor(canvas, name);
  return { card, lines: renderedLineCount(within(card).getByText(name)), name };
}

function measureNames(canvas: Canvas, names: readonly string[]): Promise<MeasuredName[]> {
  return Promise.all(names.map((name) => measureName(canvas, name)));
}

async function movePointerAway(pointer: RealPointer, canvasElement: HTMLElement) {
  await pointer.hover(canvasElement, { position: LAYOUT.pointerExit });
  await pointer.hover(canvasElement, { position: LAYOUT.pointerRest });
}

async function openCardMenu(pointer: RealPointer, card: HTMLElement) {
  await pointer.click(within(card).getByRole("button", { name: LABELS.menu }));
  return within(document.body);
}

function prefixRoster(): CharacterSummaryView[] {
  return LONG_NAMES.sentencePrefixes.map((name, index) => rosterCharacter(index + 1, name));
}

function recordNavigations(): () => void {
  recordedNavigations.length = 0;

  function onClick(event: MouseEvent) {
    const href =
      event.target instanceof Element ? event.target.closest("a")?.getAttribute("href") : undefined;
    if (typeof href !== "string") return;
    event.preventDefault();
    recordedNavigations.push(href);
  }

  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}

function renderedLineCount(text: Element): number {
  const range = document.createRange();
  range.selectNodeContents(text);
  return new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top))).size;
}

function rosterCharacter(
  index: number,
  name: string,
  overrides: Partial<CharacterSummaryView> = {},
): CharacterSummaryView {
  return makeCharacterSummary({
    characterId: `char-${index}`,
    id: `book-char-${index}`,
    name,
    ...overrides,
  });
}

function serveRoster(roster: CharacterSummaryView[]): () => void {
  const originalFetch = globalThis.fetch;
  served.roster = roster;

  const fakeFetch: typeof fetch = (input, init) => {
    const { pathname } = new URL(String(input), window.location.origin);
    const method = init?.method ?? "GET";

    if (pathname === `/api/books/${ROSTER.bookId}/character-summary`) {
      return Promise.resolve(
        jsonResponse(
          200,
          makeBookCharacterSummary({
            bookId: ROSTER.bookId,
            favoritesCount: served.roster.filter((character) => character.isFavorite).length,
          }),
        ),
      );
    }

    if (method === "GET" && pathname === `/api/books/${ROSTER.bookId}/characters`) {
      return Promise.resolve(jsonResponse(200, makeCharacterSummaryPage(served.roster)));
    }

    if (method === "PATCH" && pathname.startsWith("/api/characters/")) {
      const characterId = pathname.slice("/api/characters/".length);
      const { isFavorite } = UpdateCharacterSchema.parse(JSON.parse(String(init?.body)));
      served.roster = served.roster.map((character) =>
        character.characterId === characterId && isFavorite !== undefined
          ? { ...character, isFavorite }
          : character,
      );
      return Promise.resolve(
        jsonResponse(
          200,
          makeCharacterDetails({ id: characterId, isFavorite: isFavorite ?? false }),
        ),
      );
    }

    return Promise.resolve(jsonResponse(404, { message: `unexpected ${method} ${pathname}` }));
  };

  globalThis.fetch = fakeFetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

function topmostElementAtCentre(control: Element): HTMLElement | null | SVGElement {
  const rect = control.getBoundingClientRect();
  const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  return hit instanceof HTMLElement || hit instanceof SVGElement ? hit : null;
}

function twoLineName(names: MeasuredName[]): MeasuredName {
  const twoLines = names.find((measured) => measured.lines === 2);
  if (twoLines === undefined) {
    throw new Error(`no prefix wraps to exactly two lines: ${names.map((m) => m.lines).join(",")}`);
  }
  return twoLines;
}

const meta = {
  args: {
    book: makeBookView({ id: ROSTER.bookId }),
    roster: [rosterCharacter(1, ROSTER.name)],
  },
  beforeEach: async ({ args, canvasElement }) => {
    getQueryClient().clear();
    const { page } = await import("vitest/browser");
    await page.viewport(LAYOUT.viewport.width, LAYOUT.viewport.height);
    const restoreFetch = serveRoster(args.roster);
    const stopRecording = recordNavigations();
    return () => {
      canvasElement.style.removeProperty("width");
      stopRecording();
      restoreFetch();
    };
  },
  component: BookCharactersTab,
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-3xl p-6">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  render: ({ book }) => <BookCharactersTab book={book} />,
  tags: ["ai-generated", "!dev"],
  title: "Characters/BookCharactersTab/RealBrowser",
} satisfies Meta<RosterStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CardBodyOpensDetails: Story = {
  play: async ({ canvas }) => {
    const pointer = await loadRealPointer();
    const card = await findCard(canvas);
    const { height } = card.getBoundingClientRect();
    await pointer.click(card, {
      position: { x: ROSTER.cardBodyInsetPx, y: height - ROSTER.cardBodyInsetPx },
    });

    await waitFor(() => expect(recordedNavigations).toEqual([ROSTER.detailsHref]));
  },
};

export const MenuButtonOpensMenu: Story = {
  play: async ({ canvas }) => {
    const pointer = await loadRealPointer();
    const card = await findCard(canvas);

    const page = await openCardMenu(pointer, card);

    await waitFor(() => expect(page.getByRole("menuitem", { name: LABELS.edit })).toBeVisible());
    await expect(recordedNavigations).toEqual([]);
  },
};

export const FavoriteToggles: Story = {
  play: async ({ canvas }) => {
    const pointer = await loadRealPointer();
    const card = await findCard(canvas);
    const favorite = within(card).getByRole("button", { name: LABELS.favorite });
    await expect(favorite).toHaveAttribute("aria-pressed", "false");

    await pointer.click(favorite);

    await waitFor(() => expect(favorite).toHaveAttribute("aria-pressed", "true"));
    await expect(recordedNavigations).toEqual([]);
  },
};

export const EditOpensEditPage: Story = {
  play: async ({ canvas }) => {
    const pointer = await loadRealPointer();
    const card = await findCard(canvas);
    const page = await openCardMenu(pointer, card);

    await pointer.click(await page.findByRole("menuitem", { name: LABELS.edit }));

    await waitFor(() => expect(recordedNavigations).toEqual([ROSTER.editHref]));
  },
};

export const UnlinkOpensDialog: Story = {
  play: async ({ canvas }) => {
    const pointer = await loadRealPointer();
    const card = await findCard(canvas);
    const page = await openCardMenu(pointer, card);

    await pointer.click(await page.findByRole("menuitem", { name: LABELS.unlink }));

    await waitFor(() =>
      expect(page.getByRole("alertdialog", { name: LABELS.unlink })).toBeVisible(),
    );
    await expect(recordedNavigations).toEqual([]);
  },
};

export const MenuButtonStaysOnTopWhileHovered: Story = {
  play: async ({ canvas }) => {
    const pointer = await loadRealPointer();
    const card = await findCard(canvas);
    const menuButton = within(card).getByRole("button", { name: LABELS.menu });

    await hoverCard(pointer, card);

    await expect(menuButton).toContainElement(topmostElementAtCentre(menuButton));
  },
};

export const FavoriteStaysOnTopWhileHovered: Story = {
  play: async ({ canvas }) => {
    const pointer = await loadRealPointer();
    const card = await findCard(canvas);
    const favorite = within(card).getByRole("button", { name: LABELS.favorite });

    await hoverCard(pointer, card);

    await expect(favorite).toContainElement(topmostElementAtCentre(favorite));
  },
};

export const HoverKeepsCardInPlace: Story = {
  play: async ({ canvas, canvasElement }) => {
    const pointer = await loadRealPointer();
    const card = await findCard(canvas);
    const surface = within(card).getByRole("article");
    await pointer.hover(canvasElement, { position: { x: 1, y: 1 } });
    await expect(card.matches(":hover")).toBe(false);
    const restingBox = boxOf(surface);

    await hoverCard(pointer, card);

    await expect(boxOf(surface)).toEqual(restingBox);
  },
};

export const FocusKeepsCardInPlace: Story = {
  play: async ({ canvas, canvasElement }) => {
    const pointer = await loadRealPointer();
    const card = await findCard(canvas);
    const surface = within(card).getByRole("article");
    const nameLink = within(card).getByRole("link", { name: ROSTER.name });
    await movePointerAway(pointer, canvasElement);
    await expect(card.contains(document.activeElement)).toBe(false);
    const restingBox = boxOf(surface);

    within(card).getByRole("button", { name: LABELS.favorite }).focus();
    await pointer.tab({ shift: true });

    await expect(nameLink).toHaveFocus();
    await expect(nameLink.matches(":focus-visible")).toBe(true);
    await Promise.all(card.getAnimations({ subtree: true }).map((animation) => animation.finished));
    await expect(boxOf(surface)).toEqual(restingBox);
  },
};

export const ShortNameHasNoTooltip: Story = {
  args: {
    roster: [rosterCharacter(1, LONG_NAMES.sentence), rosterCharacter(2, ROSTER.name)],
  },
  play: async ({ canvas, canvasElement }) => {
    const pointer = await loadRealPointer();
    const longCard = await findCard(canvas, LONG_NAMES.sentence);
    const short = await measureName(canvas, ROSTER.name);
    await expect(short.lines).toBe(1);

    await hoverNameText(pointer, short.card, ROSTER.name);
    await expectNoTooltipAfterSettling();

    await movePointerAway(pointer, canvasElement);
    within(longCard).getByRole("button", { name: LABELS.menu }).focus();
    await pointer.tab();
    await expect(within(short.card).getByRole("link", { name: ROSTER.name })).toHaveFocus();
    await expectNoTooltipAfterSettling();

    await hoverNameText(pointer, longCard, LONG_NAMES.sentence);
    await expect(await findTooltip()).toHaveTextContent(LONG_NAMES.sentence);
  },
};

export const TwoLineNameHasNoTooltip: Story = {
  args: { roster: prefixRoster() },
  play: async ({ canvas }) => {
    const pointer = await loadRealPointer();
    await findCard(canvas, LONG_NAMES.sentence);
    const twoLines = twoLineName(await measureNames(canvas, LONG_NAMES.sentencePrefixes));

    await hoverNameText(pointer, twoLines.card, twoLines.name);
    await expectNoTooltipAfterSettling();

    await hoverNameText(pointer, cardFor(canvas, LONG_NAMES.sentence), LONG_NAMES.sentence);
    await expect(await findTooltip()).toHaveTextContent(LONG_NAMES.sentence);
  },
};

export const LongNameClampsToTwoLines: Story = {
  args: { roster: [rosterCharacter(1, LONG_NAMES.sentence)] },
  play: async ({ canvas }) => {
    await findCard(canvas, LONG_NAMES.sentence);
    const long = await measureName(canvas, LONG_NAMES.sentence);
    await expect(long.lines).toBeGreaterThanOrEqual(3);

    const heading = within(long.card).getByRole("heading", { name: LONG_NAMES.sentence });
    const lineHeight = Number.parseFloat(getComputedStyle(heading).lineHeight);

    await expect(Math.abs(boxOf(heading).height - 2 * lineHeight)).toBeLessThanOrEqual(1);
  },
};

export const ClampedNameShowsTooltipOnHover: Story = {
  args: { roster: [rosterCharacter(1, LONG_NAMES.sentence)] },
  play: async ({ canvas, canvasElement }) => {
    const pointer = await loadRealPointer();
    const card = await findCard(canvas, LONG_NAMES.sentence);

    await hoverNameText(pointer, card, LONG_NAMES.sentence);
    await expect(await findTooltip()).toHaveTextContent(LONG_NAMES.sentence);

    await movePointerAway(pointer, canvasElement);
    await waitFor(() => expect(within(document.body).queryByRole("tooltip")).toBeNull());
  },
};

export const ClampedNameShowsTooltipOnKeyboardFocus: Story = {
  args: {
    roster: [rosterCharacter(1, ROSTER.name), rosterCharacter(2, LONG_NAMES.sentence)],
  },
  play: async ({ canvas, canvasElement }) => {
    const pointer = await loadRealPointer();
    const shortCard = await findCard(canvas, ROSTER.name);
    const longCard = await findCard(canvas, LONG_NAMES.sentence);
    await movePointerAway(pointer, canvasElement);

    within(shortCard).getByRole("button", { name: LABELS.menu }).focus();
    await pointer.tab();

    await expect(within(longCard).getByRole("link", { name: LONG_NAMES.sentence })).toHaveFocus();
    await expect(await findTooltip()).toHaveTextContent(LONG_NAMES.sentence);
  },
};

export const CardBodyHoverOpensNoTooltip: Story = {
  args: { roster: [rosterCharacter(1, LONG_NAMES.sentence)] },
  play: async ({ canvas }) => {
    const pointer = await loadRealPointer();
    const card = await findCard(canvas, LONG_NAMES.sentence);
    const { height } = card.getBoundingClientRect();

    await pointer.hover(card, {
      position: { x: ROSTER.cardBodyInsetPx, y: height - ROSTER.cardBodyInsetPx },
    });
    await expectNoTooltipAfterSettling();

    await hoverNameText(pointer, card, LONG_NAMES.sentence);
    await expect(await findTooltip()).toHaveTextContent(LONG_NAMES.sentence);
  },
};

export const UnbrokenTokenStaysInsideCard: Story = {
  args: {
    roster: [rosterCharacter(1, LONG_NAMES.unbrokenToken), rosterCharacter(2, ROSTER.name)],
  },
  play: async ({ canvas }) => {
    const card = await findCard(canvas, LONG_NAMES.unbrokenToken);
    const neighbour = cardFor(canvas, ROSTER.name);
    const surface = within(card).getByRole("article");
    const grid = card.parentElement;
    if (grid === null) throw new Error("the roster card has no grid");
    await expect(boxOf(neighbour).top).toBe(boxOf(card).top);

    await expect(surface.scrollWidth).toBeLessThanOrEqual(surface.clientWidth);
    await expect(grid.scrollWidth).toBeLessThanOrEqual(grid.clientWidth);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth,
    );
  },
};

export const ResizingFlipsClampedState: Story = {
  args: { roster: prefixRoster() },
  play: async ({ canvas, canvasElement }) => {
    const pointer = await loadRealPointer();
    await findCard(canvas, LONG_NAMES.sentence);
    const wide = await measureNames(canvas, LONG_NAMES.sentencePrefixes);
    canvasElement.style.width = `${LAYOUT.narrowContainerPx}px`;
    const narrow = await measureNames(canvas, LONG_NAMES.sentencePrefixes);
    canvasElement.style.removeProperty("width");
    const flipping = wide.find(
      (measured, index) => measured.lines <= 2 && (narrow[index]?.lines ?? 0) >= 3,
    );
    if (flipping === undefined) throw new Error("no prefix fits wide but clamps narrow");

    await hoverNameText(pointer, flipping.card, flipping.name);
    await expectNoTooltipAfterSettling();

    await movePointerAway(pointer, canvasElement);
    canvasElement.style.width = `${LAYOUT.narrowContainerPx}px`;
    await hoverNameText(pointer, flipping.card, flipping.name);
    await expect(await findTooltip()).toHaveTextContent(flipping.name);

    await movePointerAway(pointer, canvasElement);
    await waitFor(() => expect(within(document.body).queryByRole("tooltip")).toBeNull());
    canvasElement.style.removeProperty("width");
    await hoverNameText(pointer, flipping.card, flipping.name);
    await expectNoTooltipAfterSettling();
  },
};

export const RenamingToShortNameRemovesTooltip: Story = {
  args: { roster: [rosterCharacter(1, LONG_NAMES.sentence)] },
  play: async ({ canvas, canvasElement }) => {
    const pointer = await loadRealPointer();
    const longCard = await findCard(canvas, LONG_NAMES.sentence);
    await hoverNameText(pointer, longCard, LONG_NAMES.sentence);
    await expect(await findTooltip()).toHaveTextContent(LONG_NAMES.sentence);
    await movePointerAway(pointer, canvasElement);
    await waitFor(() => expect(within(document.body).queryByRole("tooltip")).toBeNull());

    served.roster = [rosterCharacter(1, ROSTER.name)];
    await getQueryClient().invalidateQueries();
    const renamedCard = await findCard(canvas, ROSTER.name);
    await hoverNameText(pointer, renamedCard, ROSTER.name);

    await expectNoTooltipAfterSettling();
  },
};

export const SecondaryGlobalNameIsVisible: Story = {
  args: {
    roster: [rosterCharacter(1, LONG_NAMES.globalName, { displayName: LONG_NAMES.displayName })],
  },
  play: async ({ canvas }) => {
    const card = await findCard(canvas, LONG_NAMES.displayName);

    await expect(within(card).getByText(LONG_NAMES.globalName)).toBeVisible();
  },
};

export const UnbrokenTokenRowIsNoTallerThanTwoLineRow: Story = {
  args: { roster: [rosterCharacter(0, LONG_NAMES.unbrokenToken), ...prefixRoster()] },
  play: async ({ canvas }) => {
    await findCard(canvas, LONG_NAMES.sentence);
    const twoLines = twoLineName(await measureNames(canvas, LONG_NAMES.sentencePrefixes));
    const tokenCard = cardFor(canvas, LONG_NAMES.unbrokenToken);
    await expect(boxOf(tokenCard).top).not.toBe(boxOf(twoLines.card).top);

    await expect(boxOf(tokenCard).height).toBeLessThanOrEqual(boxOf(twoLines.card).height);
  },
};

export const OpeningTooltipKeepsCardInPlace: Story = {
  args: { roster: [rosterCharacter(1, LONG_NAMES.sentence)] },
  play: async ({ canvas, canvasElement }) => {
    const pointer = await loadRealPointer();
    const card = await findCard(canvas, LONG_NAMES.sentence);
    const surface = within(card).getByRole("article");
    await movePointerAway(pointer, canvasElement);
    const restingBox = boxOf(surface);

    await hoverNameText(pointer, card, LONG_NAMES.sentence);
    await findTooltip();
    await Promise.all(card.getAnimations({ subtree: true }).map((animation) => animation.finished));

    await expect(boxOf(surface)).toEqual(restingBox);
  },
};

export const TopOfViewportTooltipStaysNextToName: Story = {
  args: {
    roster: [rosterCharacter(1, ROSTER.name, { displayName: LONG_NAMES.unbrokenToken })],
  },
  decorators: [
    (Story) => (
      <>
        <Story />
        <div className="h-[200vh]" />
      </>
    ),
  ],
  play: async ({ canvas }) => {
    const pointer = await loadRealPointer();
    const card = await findCard(canvas, LONG_NAMES.unbrokenToken);
    card.scrollIntoView({ block: "start" });
    await expect(Math.abs(boxOf(card).top)).toBeLessThanOrEqual(1);
    const name = boxOf(within(card).getByRole("heading", { name: LONG_NAMES.unbrokenToken }));

    await hoverNameText(pointer, card, LONG_NAMES.unbrokenToken);
    const surface = (await findTooltip()).closest("[data-side]");
    if (surface === null) throw new Error("the tooltip has no positioned surface");
    const tooltip = boxOf(surface);
    const gap =
      tooltip.top >= name.top
        ? tooltip.top - (name.top + name.height)
        : name.top - (tooltip.top + tooltip.height);

    await expect(gap).toBeGreaterThanOrEqual(0);
    await expect(gap).toBeLessThanOrEqual(LAYOUT.tooltipMaxGapPx);
  },
};
