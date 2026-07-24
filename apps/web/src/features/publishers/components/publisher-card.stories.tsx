import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import {
  LONG_PUBLISHER_NAME,
  makePublisherListItem,
  makePublisherStats,
} from "../model/publisher.fixtures";
import { PublisherCard } from "./publisher-card";

const meta = {
  component: PublisherCard,
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-96 p-6">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  tags: ["ai-generated"],
  title: "Publishers/PublisherCard",
} satisfies Meta<typeof PublisherCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Global: Story = {
  args: { publisher: makePublisherListItem({ id: "vivat", name: "Vivat" }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Vivat")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Vivat" }).getAttribute("href")).toContain(
      "/publishers/vivat",
    );
    await expect(canvas.queryByText("Власне")).toBeNull();
  },
};

export const Custom: Story = {
  args: { publisher: makePublisherListItem({ isCustom: true, name: "Моє видавництво" }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Власне")).toBeVisible();
  },
};

export const LongName: Story = {
  args: { publisher: makePublisherListItem({ name: LONG_PUBLISHER_NAME }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(LONG_PUBLISHER_NAME)).toBeVisible();
  },
};

export const Unrated: Story = {
  args: {
    publisher: makePublisherListItem({
      stats: makePublisherStats({ averageRating: null, ratedBooksCount: 0 }),
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Без оцінок")).toBeVisible();
  },
};

export const UnknownCountry: Story = {
  args: { publisher: makePublisherListItem({ countryCode: null }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Країна невідома")).toBeVisible();
  },
};
