import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Locale } from "@/i18n/routing";

import { ThemeProvider } from "@/components/theme-provider";
import enMessages from "@/messages/en.json";
import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { AppearanceSettingsSection } from "./appearance-settings-section";

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/settings",
  useRouter: () => navigation,
}));

const COPY = {
  language: messages.settings.appearance.language,
  locales: { en: "English", uk: "Українська" },
  outsideTheCard: "Outside the card",
  theme: messages.settings.appearance.theme,
  themeOptions: messages.themePicker.options,
} as const;

const fetchMock = vi.fn<typeof fetch>();

function patchedUrls(): string[] {
  return fetchMock.mock.calls
    .filter(([, init]) => (init?.method ?? "GET").toUpperCase() === "PATCH")
    .map(([input]) => String(input));
}

const MESSAGES_BY_LOCALE = { en: enMessages, uk: messages };

function clearLeftoverLocaleSwitch() {
  const { unmount } = renderCard();
  unmount();
}

async function focusOutsideTheCard() {
  renderWithProviders(<button type="button">{COPY.outsideTheCard}</button>);
  await userEvent.click(screen.getByRole("button", { name: COPY.outsideTheCard }));
  return screen.getByRole("button", { name: COPY.outsideTheCard });
}

function renderCard(locale: Locale = "uk") {
  return renderWithProviders(
    <NextIntlClientProvider locale={locale} messages={MESSAGES_BY_LOCALE[locale]}>
      <ThemeProvider>
        <AppearanceSettingsSection />
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.reject(new Error(`unexpected ${init?.method ?? "GET"} ${String(input)}`)),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("class");
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("AppearanceSettingsSection", () => {
  describe("theme", () => {
    it("checks the system theme when nothing is stored", () => {
      renderCard();

      expect(screen.getByRole("radio", { name: COPY.themeOptions.system })).toBeChecked();
    });

    it("checks the stored dark theme", () => {
      window.localStorage.setItem("theme", "dark");

      renderCard();

      expect(screen.getByRole("radio", { name: COPY.themeOptions.dark })).toBeChecked();
    });

    it("stores and applies the light theme once it is picked", async () => {
      window.localStorage.setItem("theme", "dark");
      renderCard();

      await userEvent.click(screen.getByRole("radio", { name: COPY.themeOptions.light }));

      expect(screen.getByRole("radio", { name: COPY.themeOptions.light })).toBeChecked();
      expect(window.localStorage.getItem("theme")).toBe("light");
      expect(document.documentElement).toHaveClass("light");
      expect(document.documentElement).not.toHaveClass("dark");
    });

    it("returns to the system theme after the dark one", async () => {
      renderCard();
      await userEvent.click(screen.getByRole("radio", { name: COPY.themeOptions.dark }));
      expect(screen.getByRole("radio", { name: COPY.themeOptions.dark })).toBeChecked();

      await userEvent.click(screen.getByRole("radio", { name: COPY.themeOptions.system }));

      expect(screen.getByRole("radio", { name: COPY.themeOptions.system })).toBeChecked();
    });

    it("describes the theme choice with the system hint", () => {
      renderCard();

      expect(
        screen.getByRole("radiogroup", { name: COPY.theme.label }),
      ).toHaveAccessibleDescription(COPY.theme.hint);
    });
  });

  describe("language", () => {
    it("switches the current page to English", async () => {
      renderCard();

      await userEvent.click(screen.getByRole("radio", { name: COPY.locales.en }));

      expect(navigation.replace).toHaveBeenCalledExactlyOnceWith("/settings", { locale: "en" });
    });

    it("stays on the page when the checked language is clicked again", async () => {
      renderCard();
      const ukrainian = screen.getByRole("radio", { name: COPY.locales.uk });
      expect(ukrainian).toBeChecked();

      await userEvent.click(ukrainian);

      expect(navigation.replace).not.toHaveBeenCalled();
      expect(navigation.push).not.toHaveBeenCalled();
    });

    it("sends no request from the card itself when the theme and language change", async () => {
      renderCard();

      await userEvent.click(screen.getByRole("radio", { name: COPY.themeOptions.dark }));
      await userEvent.click(screen.getByRole("radio", { name: COPY.locales.en }));

      expect(patchedUrls()).toEqual([]);
    });

    it("describes the language choice with the pages and emails hint", () => {
      renderCard();

      expect(
        screen.getByRole("radiogroup", { name: COPY.language.label }),
      ).toHaveAccessibleDescription(COPY.language.hint);
    });
  });

  describe("focus after a language switch", () => {
    beforeEach(() => {
      clearLeftoverLocaleSwitch();
    });

    it("focuses the chosen language once the page arrives in it", async () => {
      const { unmount } = renderCard();
      await userEvent.click(screen.getByRole("radio", { name: COPY.locales.en }));
      unmount();

      renderCard("en");

      expect(screen.getByRole("radio", { name: COPY.locales.en })).toHaveFocus();
    });

    it("leaves focus where it was when the card mounts without a switch", async () => {
      const outside = await focusOutsideTheCard();

      renderCard("en");

      expect(outside).toHaveFocus();
    });

    it("forgets a switch once the card mounts in the old language and never takes focus for it", async () => {
      const { unmount: leaveUkrainianPage } = renderCard();
      await userEvent.click(screen.getByRole("radio", { name: COPY.locales.en }));
      leaveUkrainianPage();
      const outside = await focusOutsideTheCard();

      const { unmount: leaveUkrainianPageAgain } = renderCard();
      expect(outside).toHaveFocus();
      leaveUkrainianPageAgain();

      renderCard("en");
      expect(outside).toHaveFocus();
    });
  });
});
