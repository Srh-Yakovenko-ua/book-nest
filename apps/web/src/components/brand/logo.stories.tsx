import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Logo } from "@/components/brand";

const meta = {
  args: {
    variant: "horizontal",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["horizontal", "stacked", "mark", "mark-book", "wordmark"],
    },
  },
  component: Logo,
  tags: ["ai-generated"],
  title: "Brand/Logo",
} satisfies Meta<typeof Logo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {};

export const Stacked: Story = {
  args: { variant: "stacked" },
};

export const Mark: Story = {
  args: { variant: "mark" },
};

export const MarkBook: Story = {
  args: { variant: "mark-book" },
};

export const Wordmark: Story = {
  args: { variant: "wordmark" },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-8 text-ink">
      <Logo className="h-12" variant="horizontal" />
      <Logo className="h-24" variant="stacked" />
      <div className="flex items-center gap-8">
        <Logo className="h-12" variant="mark" />
        <Logo className="h-12" variant="mark-book" />
      </div>
      <Logo className="h-8" variant="wordmark" />
    </div>
  ),
};

export const OnDark: Story = {
  render: () => (
    <div className="flex flex-col gap-8 rounded-xl bg-foreground p-8 text-background">
      <Logo className="h-12" variant="horizontal" />
      <div className="flex items-center gap-8">
        <Logo className="h-12" variant="mark" />
        <Logo className="h-8" variant="wordmark" />
      </div>
    </div>
  ),
};
