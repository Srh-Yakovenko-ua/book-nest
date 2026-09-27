import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import type { BookRowBook } from "../model/library-book";

import { BookRow } from "./book-row";

const PUBLISHER_NAME = "Видавництво Старого Лева";

const book: BookRowBook = {
  authors: ["Ліна Костенко"],
  href: "/books/book-1",
  id: "book-1",
  ownershipStatus: "owned",
  publisher: PUBLISHER_NAME,
  title: "Маруся Чурай",
};

describe("BookRow publisher metadata", () => {
  it("shows the publisher by default", () => {
    renderWithProviders(<BookRow book={book} />);

    expect(screen.getByText(PUBLISHER_NAME)).toBeInTheDocument();
  });

  it("hides the publisher when the caller already fixes it", () => {
    renderWithProviders(<BookRow book={book} showPublisher={false} />);

    expect(screen.queryByText(PUBLISHER_NAME)).not.toBeInTheDocument();
    expect(screen.getByText("Маруся Чурай")).toBeInTheDocument();
  });
});
