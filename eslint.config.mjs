import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import vitest from "@vitest/eslint-plugin";
import prettier from "eslint-config-prettier";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import importX from "eslint-plugin-import-x";
import jsxA11y from "eslint-plugin-jsx-a11y";
import perfectionist from "eslint-plugin-perfectionist";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import testingLibrary from "eslint-plugin-testing-library";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tailwindEntryPoint = path.resolve(__dirname, "apps/web/src/styles/globals.css");

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/generated/**",
      "pnpm-lock.yaml",
      "api/**",
      ".claude/**",
    ],
  },

  js.configs.recommended,

  ...tseslint.configs.recommended,

  perfectionist.configs["recommended-natural"],

  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@next/next": nextPlugin,
      "better-tailwindcss": betterTailwindcss,
      "import-x": importX,
      "jsx-a11y": jsxA11y,
      react,
      "react-hooks": reactHooks,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "@next/next/no-html-link-for-pages": "off",
      "better-tailwindcss/enforce-consistent-class-order": "off",
      "better-tailwindcss/enforce-consistent-line-wrapping": "off",
      "better-tailwindcss/no-conflicting-classes": "warn",
      "better-tailwindcss/no-deprecated-classes": "warn",
      "better-tailwindcss/no-duplicate-classes": "warn",
      "better-tailwindcss/no-unknown-classes": [
        "warn",
        {
          ignore: ["dark", "group", "peer", "fill-mode-both", "delay-\\d+"],
        },
      ],
      "better-tailwindcss/no-unnecessary-whitespace": "warn",
      "import-x/no-cycle": "warn",
      "import-x/no-duplicates": "warn",
      "import-x/no-self-import": "error",
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
    },
    settings: {
      "better-tailwindcss": {
        entryPoint: tailwindEntryPoint,
      },
      "import-x/resolver-next": [
        (
          await import("eslint-import-resolver-typescript").then(
            (m) => m.createTypeScriptImportResolver,
          )
        )({
          alwaysTryTypes: true,
          project: ["apps/web/tsconfig.json"],
        }),
      ],
      react: { version: "19" },
    },
  },

  {
    files: ["apps/api/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  {
    files: ["apps/api/src/modules/**/*.controller.ts"],
    rules: {
      "perfectionist/sort-classes": "off",
    },
  },

  {
    files: ["apps/web/src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "better-tailwindcss/no-conflicting-classes": "off",
      "better-tailwindcss/no-unknown-classes": "off",
      "jsx-a11y/anchor-has-content": "off",
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/no-noninteractive-element-interactions": "off",
      "perfectionist/sort-objects": "off",
    },
  },

  {
    files: ["**/*.{test,spec}.{ts,tsx}"],
    plugins: {
      vitest,
    },
    rules: {
      ...vitest.configs.recommended.rules,
    },
  },

  {
    files: ["apps/web/**/*.{test,spec}.{ts,tsx}"],
    plugins: {
      "testing-library": testingLibrary,
    },
    rules: {
      ...testingLibrary.configs["flat/react"].rules,
    },
  },

  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  prettier,
);
