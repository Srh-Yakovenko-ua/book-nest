import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor } from "storybook/test";

import { LibrarySearchInput } from "./library-search-input";

const PLACEHOLDER = "Назва книги, автор або серія";

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="w-80">
      <LibrarySearchInput onClear={() => setValue("")} onSearch={setValue} value={value} />
      <p data-testid="committed">{value === "" ? "none" : value}</p>
      <button data-testid="external-clear" onClick={() => setValue("")} type="button">
        external clear
      </button>
    </div>
  );
}

const meta = {
  args: { onClear: () => {}, onSearch: () => {}, value: "" },
  component: LibrarySearchInput,
  tags: ["ai-generated"],
  title: "Books/LibrarySearchInput",
} satisfies Meta<typeof LibrarySearchInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByPlaceholderText(PLACEHOLDER)).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Очистити пошук" })).toBeNull();
  },
  render: () => <Harness />,
};

export const DebouncedCommit: Story = {
  play: async ({ canvas }) => {
    const input = canvas.getByPlaceholderText(PLACEHOLDER);
    await userEvent.type(input, "wing");
    await waitFor(() => expect(canvas.getByTestId("committed")).toHaveTextContent("wing"));
  },
  render: () => <Harness />,
};

export const Clearable: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId("committed")).toHaveTextContent("крило");
    await userEvent.click(canvas.getByRole("button", { name: "Очистити пошук" }));
    await waitFor(() => expect(canvas.getByTestId("committed")).toHaveTextContent("none"));
  },
  render: () => <Harness initial="крило" />,
};

export const RetypeSameAfterExternalReset: Story = {
  play: async ({ canvas }) => {
    const input = canvas.getByPlaceholderText(PLACEHOLDER);
    await userEvent.type(input, "wing");
    await waitFor(() => expect(canvas.getByTestId("committed")).toHaveTextContent("wing"));
    await userEvent.click(canvas.getByTestId("external-clear"));
    await waitFor(() => expect(canvas.getByTestId("committed")).toHaveTextContent("none"));
    await waitFor(() => expect(input).toHaveValue(""));
    await userEvent.type(input, "wing");
    await waitFor(() => expect(canvas.getByTestId("committed")).toHaveTextContent("wing"));
  },
  render: () => <Harness />,
};
