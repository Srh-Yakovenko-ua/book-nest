import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { UiIcon } from "@/components/icons";
import {
  bookFormats,
  contentFlags,
  deliveryStatuses,
  loanDueStatuses,
  ownershipStatuses,
  queuePriorities,
  readingStatuses,
  seriesStatuses,
  type StatusDefinition,
  type StatusTone,
} from "@/lib/book-status";

const TONE_CLASS: Record<StatusTone, string> = {
  accent: "border-accent-border bg-accent text-accent-foreground",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  info: "border-info/30 bg-info/10 text-info",
  neutral: "border-border bg-muted text-muted-foreground",
  primary: "border-primary/30 bg-primary/10 text-primary",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
};

function StatusGroup({ entries, name }: { entries: readonly StatusDefinition[]; name: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
        {name}
      </h3>
      <div className="flex flex-wrap gap-2">
        {entries.map((entry) => (
          <StatusPill entry={entry} key={entry.value} />
        ))}
      </div>
    </section>
  );
}

function StatusPill({ entry }: { entry: StatusDefinition }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${TONE_CLASS[entry.tone]}`}
    >
      <UiIcon name={entry.icon} size={14} />
      {entry.value}
    </span>
  );
}

const meta = {
  args: {
    entry: readingStatuses[0],
  },
  component: StatusPill,
  tags: ["ai-generated"],
  title: "Patterns/BookStatus",
} satisfies Meta<typeof StatusPill>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Pill: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText(readingStatuses[0].value)).toBeVisible();
  },
};

export const AllGroups: Story = {
  render: () => (
    <div className="flex max-w-2xl flex-col gap-6 text-foreground">
      <StatusGroup entries={readingStatuses} name="Reading" />
      <StatusGroup entries={ownershipStatuses} name="Ownership" />
      <StatusGroup entries={bookFormats} name="Format" />
      <StatusGroup entries={seriesStatuses} name="Series" />
      <StatusGroup entries={deliveryStatuses} name="Delivery" />
      <StatusGroup entries={loanDueStatuses} name="Loan due" />
      <StatusGroup entries={queuePriorities} name="Queue priority" />
      <StatusGroup entries={contentFlags} name="Content flags" />
    </div>
  ),
};
