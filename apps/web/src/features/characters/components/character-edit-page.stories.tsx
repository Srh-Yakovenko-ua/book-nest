import type { CharacterDetailsView, MediaView } from "@app/shared";
import type { Decorator, Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { expect, waitFor } from "storybook/test";

import { makeBookCharacterView, makeCharacterDetails } from "../model/characters.fixtures";
import { CharacterEditPage } from "./character-edit-page";

const STORY = {
  avatarUrl: "/auth/cover-login.webp",
  bookId: "book-1",
  bookSectionTitles: [
    "У цій книзі",
    "Роль у розповіді",
    "Про персонажа",
    "Лише для цієї книги",
    "Інші імена",
    "Спойлери",
  ],
  characterId: "char-1",
} as const;

const globalAvatar: MediaView = {
  contentType: "image/webp",
  createdAt: "2026-06-27T00:00:00.000Z",
  height: 1200,
  id: "media-avatar-1",
  kind: "avatar",
  name: "geralt.webp",
  sizeBytes: 89760,
  urls: { card: STORY.avatarUrl, full: STORY.avatarUrl, thumb: STORY.avatarUrl },
  width: 900,
};

const character = makeCharacterDetails({
  aliases: [
    {
      bookId: null,
      id: "alias-global-1",
      isSpoiler: false,
      name: "Білий Вовк",
      position: 0,
      type: "nickname",
    },
    {
      bookId: STORY.bookId,
      id: "alias-book-1",
      isSpoiler: false,
      name: "Різник з Блавікена",
      position: 0,
      type: "nickname",
    },
  ],
  appearances: [
    makeBookCharacterView({
      bookId: STORY.bookId,
      description: "Відьмак, який шукає роботу на півночі і щоразу встряє в чужі історії.",
      descriptionIsSpoiler: true,
      firstAppearanceChapter: "Голос розуму",
      firstAppearancePage: 7,
      importance: "central",
      isPovCharacter: true,
      personalImpression: "Стриманий, втомлений, але чесний до кінця.",
      personalImpressionIsSpoiler: true,
      speciesOverride: "Мутант",
      status: "active",
    }),
  ],
  avatar: globalAvatar,
  gender: "male",
  name: "Ґеральт",
  neutralDescription: "Мисливець на чудовиськ із Рівії, вихованець Каер Морхена.",
  pronouns: "він / його",
  species: "Відьмак",
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mockFetch(details: CharacterDetailsView) {
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const path = typeof input === "string" ? input : input.toString();
    if (path.includes(`/api/characters/${details.id}`))
      return Promise.resolve(jsonResponse(200, details));
    return Promise.resolve(jsonResponse(200, {}));
  }) as typeof fetch;
}

function RouteShell({ children }: { children: ReactNode }) {
  const t = useTranslations("characters.edit");

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div
        aria-hidden
        className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:block"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div
          aria-hidden
          className="sticky top-0 z-30 h-[var(--shell-header-height)] shrink-0 border-b border-border/50 bg-background/80 backdrop-blur-xl backdrop-saturate-150"
        />
        <main className="mx-auto w-full max-w-7xl flex-1 px-5 pt-8 pb-16 md:px-8 lg:px-12">
          <header className="mb-8 flex flex-col gap-2 md:mb-10">
            <div className="flex items-center gap-3">
              <Image
                alt=""
                aria-hidden
                className="h-auto w-14 shrink-0 select-none"
                height={809}
                src="/illustrations/pen.png"
                unoptimized
                width={860}
              />
              <h1 className="font-heading text-[clamp(1.875rem,4vw,2.75rem)] leading-tight font-semibold text-ink">
                {t("title")}
              </h1>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              {t("subtitle")}
            </p>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}

function withSearch(search: string): Decorator {
  return function SearchParamsDecorator(Story) {
    return (
      <NuqsTestingAdapter searchParams={search}>
        <Story />
      </NuqsTestingAdapter>
    );
  };
}

const meta = {
  args: { characterId: STORY.characterId },
  component: CharacterEditPage,
  decorators: [
    (Story) => (
      <RouteShell>
        <Story />
      </RouteShell>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
  },
  tags: ["ai-generated"],
  title: "Characters/CharacterEditPage",
} satisfies Meta<typeof CharacterEditPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const BookContext: Story = {
  beforeEach: () => {
    mockFetch(character);
  },
  decorators: [withSearch(`bookId=${STORY.bookId}`)],
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByDisplayValue("Ґеральт")).toBeVisible();
    });
    const renderedTitles = canvas
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent ?? "")
      .filter((title) => STORY.bookSectionTitles.some((expected) => expected === title));
    await expect(renderedTitles).toEqual([...STORY.bookSectionTitles]);
    await expect(canvas.getByRole("region", { name: "Зображення в цій книзі" })).toBeVisible();
    await expect(canvas.getByRole("region", { name: "Попередній перегляд" })).toBeVisible();
    await expect(canvas.getByText("Приховано: 2")).toBeVisible();
  },
};

export const Global: Story = {
  beforeEach: () => {
    mockFetch(character);
  },
  decorators: [withSearch("")],
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByDisplayValue("Ґеральт")).toBeVisible();
    });
    await expect(canvas.getByRole("heading", { level: 2, name: "Про персонажа" })).toBeVisible();
    await expect(canvas.getByRole("heading", { level: 2, name: "Інші імена" })).toBeVisible();
    await expect(canvas.queryByRole("heading", { name: "У цій книзі" })).toBeNull();
    await expect(canvas.queryByRole("heading", { name: "Спойлери" })).toBeNull();
    await expect(canvas.queryByRole("region", { name: "Зображення в цій книзі" })).toBeNull();
    await expect(canvas.getByRole("region", { name: "Попередній перегляд" })).toBeVisible();
  },
};
