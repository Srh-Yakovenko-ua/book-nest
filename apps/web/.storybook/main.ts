import type { StorybookConfig } from "@storybook/react-vite";

import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  viteFinal(cfg) {
    cfg.plugins ??= [];
    cfg.plugins.push(tailwindcss());

    cfg.resolve ??= {};
    cfg.resolve.alias = {
      ...cfg.resolve.alias,
      "@": path.resolve(__dirname, "../src"),
    };

    return cfg;
  },
};

export default config;
