import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent } from "storybook/test";

import { TagInput } from "./tag-input";

const meta = {
  args: {
    onValueChange: () => {},
    value: [],
  },
  component: TagInput,
  tags: ["ai-generated"],
  title: "UI/TagInput",
} satisfies Meta<typeof TagInput>;

export default meta;

type Story = StoryObj<typeof meta>;

function Example({ initial }: { initial: string[] }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="max-w-md">
      <TagInput onValueChange={setValue} value={value} />
    </div>
  );
}

export const Empty: Story = {
  render: () => <Example initial={[]} />,
};

export const WithTags: Story = {
  render: () => <Example initial={["Fantasy", "Young Adult", "Slow burn"]} />,
};

export const Disabled: Story = {
  render: () => (
    <div className="max-w-md">
      <TagInput disabled onValueChange={() => {}} value={["Fantasy", "Young Adult"]} />
    </div>
  ),
};

export const TypeEnterAddsChip: Story = {
  render: () => <Example initial={[]} />,
  play: async ({ canvas }) => {
    const input = canvas.getByRole("textbox");
    await userEvent.type(input, "Dragons{Enter}");
    await expect(canvas.getByText("Dragons")).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "Видалити тег «Dragons»" }),
    ).toBeInTheDocument();
  },
};
