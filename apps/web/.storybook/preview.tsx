import type { Decorator, Preview } from "@storybook/react";

import React, { useEffect } from "react";

import "../src/index.css";

const ThemeDecorator: Decorator = (Story, context) => {
  const { theme = "light" } = context.globals as { theme?: string };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  return <Story />;
};

const preview: Preview = {
  decorators: [ThemeDecorator],
  globalTypes: {
    theme: {
      description: "Color scheme",
      toolbar: {
        dynamicTitle: true,
        icon: "circlehollow",
        items: [
          { icon: "sun", title: "Light", value: "light" },
          { icon: "moon", title: "Dark", value: "dark" },
        ],
        title: "Theme",
      },
    },
  },
  initialGlobals: {
    theme: "light",
  },
  parameters: {
    layout: "centered",
  },
};

export default preview;
