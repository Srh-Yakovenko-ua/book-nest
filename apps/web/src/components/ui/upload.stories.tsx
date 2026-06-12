import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";

import { Upload } from "./upload";

const meta = {
  args: {
    files: [],
    onFilesChange: () => {},
  },
  component: Upload,
  tags: ["ai-generated"],
  title: "UI/Upload",
} satisfies Meta<typeof Upload>;

export default meta;

type Story = StoryObj<typeof meta>;

function Example({ initial }: { initial: File[] }) {
  const [files, setFiles] = useState(initial);
  return (
    <div className="max-w-md">
      <Upload
        accept="image/png,image/jpeg"
        browseLabel="Завантажити обкладинку"
        files={files}
        hint="Формат: JPG, PNG · Макс. 5 МБ · 1200×1600"
        multiple
        onFilesChange={setFiles}
        title="Перетягніть зображення сюди"
      />
    </div>
  );
}

function makeFile(name: string, size: number) {
  const file = new File(["x"], name, { type: "image/jpeg" });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

export const Idle: Story = {
  render: () => <Example initial={[]} />,
};

export const WithFiles: Story = {
  render: () => (
    <Example initial={[makeFile("cover.jpg", 2_516_582), makeFile("back-cover.png", 1_258_291)]} />
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="max-w-md">
      <Upload
        browseLabel="Завантажити обкладинку"
        disabled
        files={[makeFile("cover.jpg", 2_516_582)]}
        hint="Завантаження недоступне"
        onFilesChange={() => {}}
      />
    </div>
  ),
};
