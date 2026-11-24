import type { ShotsManifest } from "../shots-manifest.ts";

import { readingGoalsManifest } from "./reading-goals.ts";

export const SHOT_MANIFESTS: Readonly<Record<string, ShotsManifest>> = {
  [readingGoalsManifest.feature]: readingGoalsManifest,
};
