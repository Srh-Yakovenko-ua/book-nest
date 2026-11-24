import type { Page } from "playwright";

export type AppScene = {
  capture?: ShotCapture;
  cleanup?: readonly ShotStep[];
  description: string;
  id: string;
  path?: string;
  steps?: readonly ShotStep[];
  title: string;
  viewports?: readonly ShotViewportName[];
};

export type LocalizedName = Readonly<Record<ShotLocale, RegExp | string>>;

export type ShotCapture = "page" | "viewport";

export type ShotLocale = "en" | "uk";

export type ShotRole = "button" | "dialog" | "menu" | "menuitem" | "radio" | "tab";

export type ShotsManifest = {
  appScenes: readonly AppScene[];
  discoverTargets: (discovery: TargetDiscovery) => Promise<ShotTargets>;
  feature: string;
  focus: readonly string[];
  stories: readonly StoryScene[];
  summary: string;
  title: string;
};

export type ShotStep =
  | { key: string; kind: "press" }
  | { kind: "click"; name: LocalizedName; role: ShotRole }
  | { kind: "waitFor"; role: ShotRole };

export type ShotTargets = Readonly<Record<string, string>>;

export type ShotTheme = "dark" | "light";

export type ShotViewportName = "desktop" | "mobile";

export type StoryScene = {
  description: string;
  id: string;
  storyId: string;
  title: string;
};

export type TargetDiscovery = {
  open: (path: string) => Promise<void>;
  page: Page;
};
