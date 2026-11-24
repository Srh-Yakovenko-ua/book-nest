import type { ShotLocale, ShotTheme, ShotViewportName } from "./shots-manifest.ts";

export type SceneInfo = {
  description: string;
  id: string;
  order: number;
  source: "app" | "storybook";
  title: string;
};

export type ShotRecord =
  | {
      file: string;
      kind: "captured";
      locale: ShotLocale;
      scene: SceneInfo;
      theme: ShotTheme;
      url: string;
      viewport: ShotViewportName;
      warnings: readonly string[];
    }
  | { kind: "skipped"; reason: string; scene: SceneInfo; viewport: ShotViewportName };

export function errorSummary(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0] ?? message;
}

export function shotFileName({
  locale,
  scene,
  theme,
  viewport,
}: {
  locale: ShotLocale;
  scene: SceneInfo;
  theme: ShotTheme;
  viewport: ShotViewportName;
}): string {
  return `${String(scene.order).padStart(2, "0")}-${scene.id}-${viewport}-${theme}-${locale}.png`;
}
