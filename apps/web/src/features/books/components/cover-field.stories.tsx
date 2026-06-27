import type { MediaView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, spyOn, userEvent, waitFor, within } from "storybook/test";

import type { CoverState } from "../model/cover-state";

import { CoverField } from "./cover-field";

function CoverFieldHarness({
  hadInitialCover,
  initial,
}: {
  hadInitialCover: boolean;
  initial: CoverState;
}) {
  const [state, setState] = useState(initial);
  return (
    <div className="w-[420px]">
      <CoverField hadInitialCover={hadInitialCover} onChange={setState} state={state} />
    </div>
  );
}

function dataUrlToFile(dataUrl: string, name: string) {
  const parts = dataUrl.split(",");
  const header = parts[0] ?? "";
  const encoded = parts[1] ?? "";
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], name, { type: mime });
}

function existingCover(): CoverState {
  const url = makeCoverDataUrl("#7c5230");
  const media: MediaView = {
    contentType: "image/webp",
    createdAt: "2026-06-27T00:00:00.000Z",
    height: 1600,
    id: "media-1",
    kind: "book_cover",
    name: "cover.webp",
    sizeBytes: 234567,
    urls: { card: url, full: url, thumb: url },
    width: 1066,
  };
  return { kind: "existing", media };
}

function makeCoverDataUrl(fill: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 600;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = fill;
    context.fillRect(0, 0, 400, 600);
  }
  return canvas.toDataURL("image/png");
}

const meta = {
  args: {
    hadInitialCover: false,
    onChange: () => {},
    state: { kind: "empty" },
  },
  component: CoverField,
  parameters: {
    layout: "centered",
    nextjs: { appDirectory: true },
  },
  tags: ["ai-generated"],
  title: "Books/CoverField",
} satisfies Meta<typeof CoverField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CreateMode: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Обкладинка книги" })).toBeVisible();
    await waitFor(() =>
      expect(
        canvas.getByRole("button", {
          name: /Перетягніть зображення сюди.*Завантажити обкладинку/,
        }),
      ).toBeVisible(),
    );
  },
  render: () => <CoverFieldHarness hadInitialCover={false} initial={{ kind: "empty" }} />,
};

export const UploadAndCrop: Story = {
  play: async ({ canvas }) => {
    const surface = within(document.body);
    const file = dataUrlToFile(makeCoverDataUrl("#a96e47"), "cover.png");

    await userEvent.upload(canvas.getByLabelText("Перетягніть зображення сюди"), file);

    await surface.findByRole("dialog");
    const apply = surface.getByRole("button", { name: "Застосувати" });
    await waitFor(() => expect(apply).toBeEnabled(), { timeout: 5000 });
    await userEvent.click(apply);

    await canvas.findByRole("img", { name: "Обкладинка книги" });
    await waitFor(() =>
      expect(canvas.getByRole("img", { name: "Обкладинка книги" })).toBeVisible(),
    );
    await expect(canvas.getByRole("button", { name: "Замінити обкладинку" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Видалити обкладинку" })).toBeVisible();
  },
  render: () => <CoverFieldHarness hadInitialCover={false} initial={{ kind: "empty" }} />,
};

export const EditWithExistingCover: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole("img", { name: "Обкладинка книги" });
    await waitFor(() =>
      expect(canvas.getByRole("img", { name: "Обкладинка книги" })).toBeVisible(),
    );
    await expect(canvas.getByRole("button", { name: "Замінити обкладинку" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Видалити обкладинку" })).toBeVisible();
  },
  render: () => <CoverFieldHarness hadInitialCover initial={existingCover()} />,
};

export const CropEscapeRestoresFocus: Story = {
  play: async ({ canvas }) => {
    const surface = within(document.body);
    const file = dataUrlToFile(makeCoverDataUrl("#a96e47"), "cover.png");

    const dropzone = canvas.getByRole("button", {
      name: /Перетягніть зображення сюди.*Завантажити обкладинку/,
    });
    dropzone.focus();
    await userEvent.upload(canvas.getByLabelText("Перетягніть зображення сюди"), file);

    await surface.findByRole("dialog");
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(surface.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(dropzone).toHaveFocus());
  },
  render: () => <CoverFieldHarness hadInitialCover={false} initial={{ kind: "empty" }} />,
};

export const RemoveConfirmEscapeRestoresFocus: Story = {
  play: async ({ canvas }) => {
    const surface = within(document.body);

    const removeButton = canvas.getByRole("button", { name: "Видалити обкладинку" });
    await userEvent.click(removeButton);

    await surface.findByRole("alertdialog");
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(surface.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(removeButton).toHaveFocus());
  },
  render: () => <CoverFieldHarness hadInitialCover initial={existingCover()} />,
};

export const ViewerOpensFromExistingCover: Story = {
  play: async ({ canvas }) => {
    const surface = within(document.body);

    await userEvent.click(
      await canvas.findByRole("button", { name: "Переглянути обкладинку у повному розмірі" }),
    );

    const dialog = await surface.findByRole("dialog");
    await expect(dialog).toHaveAccessibleName("Обкладинка книги");
    await waitFor(() =>
      expect(within(dialog).getByRole("img", { name: "Обкладинка книги" })).toBeVisible(),
    );
  },
  render: () => <CoverFieldHarness hadInitialCover initial={existingCover()} />,
};

export const ViewerEscapeRestoresFocus: Story = {
  play: async ({ canvas }) => {
    const surface = within(document.body);

    const trigger = await canvas.findByRole("button", {
      name: "Переглянути обкладинку у повному розмірі",
    });
    trigger.focus();
    await userEvent.click(trigger);

    await surface.findByRole("dialog");
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(surface.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  },
  render: () => <CoverFieldHarness hadInitialCover initial={existingCover()} />,
};

export const EditRemoveAsksConfirmation: Story = {
  play: async ({ canvas }) => {
    const surface = within(document.body);

    await userEvent.click(canvas.getByRole("button", { name: "Видалити обкладинку" }));

    const dialog = within(await surface.findByRole("alertdialog"));
    await waitFor(() => expect(dialog.getByText("Видалити обкладинку?")).toBeVisible());

    await userEvent.click(dialog.getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(surface.queryByRole("alertdialog")).not.toBeInTheDocument());
    await expect(canvas.queryByRole("img", { name: "Обкладинка книги" })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        canvas.getByRole("button", {
          name: /Перетягніть зображення сюди.*Завантажити обкладинку/,
        }),
      ).toBeVisible(),
    );
  },
  render: () => <CoverFieldHarness hadInitialCover initial={existingCover()} />,
};

export const DeleteFromViewerAsksConfirmation: Story = {
  play: async ({ canvas }) => {
    const surface = within(document.body);

    await userEvent.click(
      await canvas.findByRole("button", { name: "Переглянути обкладинку у повному розмірі" }),
    );
    const viewer = within(await surface.findByRole("dialog"));
    const viewerDelete = viewer.getByRole("button", { name: "Видалити обкладинку" });
    await waitFor(() => expect(viewerDelete).toBeVisible());
    await userEvent.click(viewerDelete);

    await waitFor(() => expect(surface.queryByRole("dialog")).not.toBeInTheDocument());
    const confirm = within(await surface.findByRole("alertdialog"));
    await waitFor(() => expect(confirm.getByText("Видалити обкладинку?")).toBeVisible());

    await userEvent.click(confirm.getByRole("button", { name: "Скасувати" }));
    await waitFor(() => expect(surface.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe("none"));

    const remove = canvas.getByRole("button", { name: "Видалити обкладинку" });
    await expect(remove).toBeEnabled();
    await userEvent.click(remove);
    const reopened = await surface.findByRole("alertdialog");
    await waitFor(() => expect(reopened).toBeVisible());
  },
  render: () => <CoverFieldHarness hadInitialCover initial={existingCover()} />,
};

export const DeleteFromViewerConfirmRemovesCover: Story = {
  play: async ({ canvas }) => {
    const surface = within(document.body);

    await userEvent.click(
      await canvas.findByRole("button", { name: "Переглянути обкладинку у повному розмірі" }),
    );
    const viewer = within(await surface.findByRole("dialog"));
    const viewerDelete = viewer.getByRole("button", { name: "Видалити обкладинку" });
    await waitFor(() => expect(viewerDelete).toBeVisible());
    await userEvent.click(viewerDelete);

    const confirm = within(await surface.findByRole("alertdialog"));
    const confirmDelete = confirm.getByRole("button", { name: "Видалити" });
    await waitFor(() => expect(confirmDelete).toBeVisible());
    await userEvent.click(confirmDelete);

    await waitFor(() => expect(surface.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe("none"));
    await waitFor(() =>
      expect(canvas.queryByRole("img", { name: "Обкладинка книги" })).not.toBeInTheDocument(),
    );
    await canvas.findByRole("button", {
      name: /Перетягніть зображення сюди.*Завантажити обкладинку/,
    });
    await waitFor(() =>
      expect(
        canvas.getByRole("button", {
          name: /Перетягніть зображення сюди.*Завантажити обкладинку/,
        }),
      ).toBeVisible(),
    );
  },
  render: () => <CoverFieldHarness hadInitialCover initial={existingCover()} />,
};

export const ReplaceFromViewerOpensPicker: Story = {
  play: async ({ canvas }) => {
    const surface = within(document.body);
    const clickSpy = spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});

    await userEvent.click(
      await canvas.findByRole("button", { name: "Переглянути обкладинку у повному розмірі" }),
    );
    const viewer = within(await surface.findByRole("dialog"));
    const viewerReplace = viewer.getByRole("button", { name: "Замінити обкладинку" });
    await waitFor(() => expect(viewerReplace).toBeVisible());
    await userEvent.click(viewerReplace);

    await waitFor(() => expect(surface.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe("none"));

    clickSpy.mockRestore();
  },
  render: () => <CoverFieldHarness hadInitialCover initial={existingCover()} />,
};
