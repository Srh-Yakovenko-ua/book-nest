import "@testing-library/jest-dom/vitest";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LoanContactSelection } from "@/features/loans/model/loan-contact-selection";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import type { CreateBookFormOutput, CreateBookFormValues } from "../model/create-book-form";

import { pruneStatusPayload } from "../model/book-status-fields";
import { bookViewToFormState } from "../model/book-view-to-form";
import { CreateBookFormSchema } from "../model/create-book-form";
import { makeBookView } from "./book-details.fixtures";
import { OwnershipStatusSection } from "./ownership-status-section";

const NOTE_LABEL = messages.books.ownershipStatus.fields.note;
const STORE_URL = "https://www.yakaboo.ua/ostannie-bazhannja.html";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({ items: [] }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function borrowedBook() {
  return makeBookView({
    loanInfo: {
      contact: null,
      expectedReturnDate: null,
      loanContactId: "66666666-6666-4666-8666-666666666666",
      loanDate: "2026-06-01",
      loanType: "borrowed_from_someone",
      loanUiStatus: "on_time",
      note: "Повернути після відпустки",
      personName: "Ольга",
      remindBeforeDays: null,
      remindToReturn: false,
    },
    ownershipStatus: "borrowed_from_someone",
  });
}

function Harness({
  initialLoanContact,
  initialValues,
  onSubmit,
}: {
  initialLoanContact: LoanContactSelection | null;
  initialValues: CreateBookFormValues;
  onSubmit: (values: CreateBookFormOutput) => void;
}) {
  const form = useForm<CreateBookFormValues, unknown, CreateBookFormOutput>({
    defaultValues: initialValues,
    resolver: zodResolver(CreateBookFormSchema),
  });
  const [loanContact, setLoanContact] = useState(initialLoanContact);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <OwnershipStatusSection
        control={form.control}
        errors={form.formState.errors}
        loanContact={loanContact}
        mode="edit"
        onLoanContactChange={setLoanContact}
        register={form.register}
        setValue={form.setValue}
      />
      <button type="submit">submit</button>
    </form>
  );
}

function renderSection(
  initialValues: CreateBookFormValues,
  initialLoanContact: LoanContactSelection | null = null,
) {
  const onSubmit = vi.fn<(values: CreateBookFormOutput) => void>();
  renderWithProviders(
    <Harness
      initialLoanContact={initialLoanContact}
      initialValues={initialValues}
      onSubmit={onSubmit}
    />,
  );
  return { onSubmit };
}

function wishlistValues(): CreateBookFormValues {
  return bookViewToFormState(
    makeBookView({
      ownershipStatus: "want_to_buy",
      purchaseInfo: {
        currency: "UAH",
        expectedPrice: 450,
        note: "Дочекатися знижки",
        purchasedAt: null,
        storeName: "Yakaboo",
        storeUrl: STORE_URL,
      },
    }),
  ).values;
}

describe("OwnershipStatusSection purchase note removal", () => {
  it("renders no note field for a wishlist book", () => {
    renderSection(wishlistValues());

    expect(screen.queryByLabelText(NOTE_LABEL)).toBeNull();
  });

  it("keeps the note field of a borrowed book", () => {
    const borrowed = bookViewToFormState(borrowedBook());
    renderSection(borrowed.values, borrowed.loanContactSelection);

    expect(screen.getByLabelText(NOTE_LABEL)).toHaveValue("Повернути після відпустки");
  });

  it("shows the person of a saved loan even when the contact search returns nothing", () => {
    const borrowed = bookViewToFormState(borrowedBook());
    renderSection(borrowed.values, borrowed.loanContactSelection);

    expect(screen.getByLabelText(messages.books.loanInfo.fields.personName)).toHaveValue("Ольга");
  });

  it("omits the purchase note from the submitted payload of a book that still stores one", async () => {
    const { onSubmit } = renderSection(wishlistValues());

    await userEvent.click(screen.getByRole("button", { name: "submit" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const values = onSubmit.mock.calls[0]?.[0];
    if (values === undefined) throw new Error("form did not submit");

    const payload = pruneStatusPayload(values);

    expect(payload.purchaseInfo).toStrictEqual({
      currency: "UAH",
      expectedPrice: 450,
      storeName: "Yakaboo",
      storeUrl: STORE_URL,
    });
    expect(payload.purchaseInfo).not.toHaveProperty("note");
    expect(JSON.stringify(payload.purchaseInfo)).not.toContain("note");
  });
});
