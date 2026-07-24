import "@testing-library/jest-dom/vitest";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import type { CreateBookFormValues } from "../model/create-book-form";

import { createBookFormDefaults, CreateBookFormSchema } from "../model/create-book-form";
import { EditionDetailsSection } from "./edition-details-section";

const fields = messages.books.editionDetails.fields;

function Harness({
  initialValues = {},
  onSubmit,
}: {
  initialValues?: Partial<CreateBookFormValues>;
  onSubmit: (values: CreateBookFormValues) => void;
}) {
  const form = useForm<CreateBookFormValues>({
    defaultValues: {
      ...createBookFormDefaults,
      authors: [{ name: "Лі Бардуго" }],
      title: "Біснуватий",
      ...initialValues,
    },
    resolver: zodResolver(CreateBookFormSchema),
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <EditionDetailsSection
        control={form.control}
        errors={form.formState.errors}
        register={form.register}
      />
      <button type="submit">submit</button>
    </form>
  );
}

function renderSection(initialValues: Partial<CreateBookFormValues> = {}) {
  const onSubmit = vi.fn();
  renderWithProviders(<Harness initialValues={initialValues} onSubmit={onSubmit} />);
  return { onSubmit };
}

async function submit() {
  await userEvent.click(screen.getByRole("button", { name: "submit" }));
}

describe("EditionDetailsSection clearing optional fields", () => {
  it("sends null for the pages count when the field is emptied", async () => {
    const { onSubmit } = renderSection({ pagesCount: 576 });

    const input = screen.getByLabelText(new RegExp(fields.pagesCount));
    await userEvent.clear(input);
    await submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ pagesCount: null });
  });

  it("keeps a typed pages count untouched", async () => {
    const { onSubmit } = renderSection({ pagesCount: 576 });

    const input = screen.getByLabelText(new RegExp(fields.pagesCount));
    await userEvent.clear(input);
    await userEvent.type(input, "320");
    await submit();

    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ pagesCount: 320 });
  });

  it("sends null for the emptied translator and illustrator", async () => {
    const { onSubmit } = renderSection({
      illustrator: "Кевін Танг",
      translator: "Олена Оксенич",
    });

    await userEvent.clear(screen.getByLabelText(new RegExp(fields.translator)));
    await userEvent.clear(screen.getByLabelText(new RegExp(fields.illustrator)));
    await submit();

    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ illustrator: null, translator: null });
  });

  it("sends null for the emptied isbn", async () => {
    const { onSubmit } = renderSection({ isbn: "9786175230404" });

    await userEvent.clear(screen.getByLabelText(new RegExp(fields.isbn)));
    await submit();

    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ isbn: null });
  });
});
