import "@testing-library/jest-dom/vitest";
import { useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { CreateBookFormValues } from "../model/create-book-form";

import { TagsField } from "./tags-field";

const SAVED_TAGS = [
  { color: "sage", id: "tag-slow-burn", name: "slow burn" },
  { color: "rose", id: "tag-cozy", name: "cozy" },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost");
      if (url.pathname !== "/api/tags") {
        return Promise.resolve(new Response(null, { status: 404 }));
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            items: SAVED_TAGS,
            page: 1,
            pagesCount: 1,
            pageSize: 20,
            totalCount: SAVED_TAGS.length,
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      );
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TagsField picker", () => {
  it("offers saved tags without any control that deletes a tag globally", async () => {
    renderWithProviders(<TagsFieldHost />);

    await userEvent.click(screen.getByRole("combobox"));

    const listbox = await screen.findByRole("listbox");
    expect(await within(listbox).findByRole("option", { name: "slow burn" })).toBeInTheDocument();
    expect(within(listbox).getByRole("option", { name: "cozy" })).toBeInTheDocument();
    expect(within(listbox).queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Видалити/ })).not.toBeInTheDocument();
  });

  it("adds a saved tag to the book when it is picked", async () => {
    renderWithProviders(<TagsFieldHost />);

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "slow burn" }));

    expect(screen.getByRole("button", { name: "Видалити тег «slow burn»" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "slow burn" })).not.toBeInTheDocument();
  });
});

function TagsFieldHost() {
  const { control, formState } = useForm<CreateBookFormValues>({ defaultValues: { tags: [] } });
  return <TagsField control={control} errors={formState.errors} />;
}
