import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import type { LegalDocumentContent } from "../content/types";

import { LegalDocument } from "./legal-document";

const sample: LegalDocumentContent = {
  lastUpdated: "Last updated: 9 July 2026",
  lead: ["A short readable introduction to the document."],
  sections: [
    {
      blocks: [
        { kind: "paragraph", text: "Reach us at **privacy@book-nest.net** any time." },
        { kind: "subheading", text: "What we store" },
        { items: ["Your books", "Your notes"], kind: "list" },
        { kind: "paragraph", text: "We set a cookie called `refresh_token`." },
      ],
      heading: "1. Overview",
      id: "overview",
    },
  ],
  title: "Sample Document",
};

const meta = {
  args: sample,
  component: LegalDocument,
  parameters: {
    layout: "padded",
    nextjs: { appDirectory: true },
  },
  tags: ["ai-generated"],
  title: "Legal/LegalDocument",
} satisfies Meta<typeof LegalDocument>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 1, name: "Sample Document" })).toBeVisible();
    await expect(canvas.getByRole("heading", { level: 2, name: "1. Overview" })).toBeVisible();
    await expect(canvas.getByRole("heading", { level: 3, name: "What we store" })).toBeVisible();
    await expect(canvas.getAllByRole("listitem")).toHaveLength(2);
    await expect(canvas.getByText("privacy@book-nest.net")).toBeVisible();
    await expect(canvas.getByText("refresh_token")).toBeVisible();
  },
};
