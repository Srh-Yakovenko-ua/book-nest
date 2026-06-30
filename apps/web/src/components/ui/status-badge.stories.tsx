import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import {
  deliveryStatuses,
  loanDueStatuses,
  ownershipStatuses,
  readingStatuses,
  type StatusEntry,
} from "@/lib/book-status";

import { StatusBadge } from "./status-badge";

const meta = {
  args: {
    entry: readingStatuses[2],
  },
  component: StatusBadge,
  tags: ["ai-generated"],
  title: "UI/StatusBadge",
} satisfies Meta<typeof StatusBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

function Row({ entries, title }: { entries: readonly StatusEntry[]; title: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {entries.map((entry) => (
          <StatusBadge entry={entry} key={entry.value} />
        ))}
      </div>
    </section>
  );
}

export const Single: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText(readingStatuses[2].label)).toBeVisible();
  },
};

export const ReadingStatuses: Story = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-5 text-foreground">
      <Row entries={readingStatuses} title="Reading" />
      <Row entries={ownershipStatuses} title="Ownership" />
    </div>
  ),
};

export const Tones: Story = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-5 text-foreground">
      <Row entries={deliveryStatuses} title="Delivery" />
      <Row entries={loanDueStatuses} title="Loan due" />
    </div>
  ),
};
