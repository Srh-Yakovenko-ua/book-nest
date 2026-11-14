import type { ReactNode } from "react";

import { LOAN_ERROR_CODES } from "@app/shared";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeBookView } from "./book-details.fixtures";
import { OwnershipBlock } from "./ownership-block";

const ownershipMessages = messages.books.details.ownership;
const loanErrors = messages.books.details.loan.errors;
const SERVER_MESSAGES = {
  alreadyOwned: "Book is already owned",
  notOnLoan: "Book is not on loan",
} as const;

const fetchMock = vi.fn();

let respondToMarkOwned: () => Response;
let respondToReturnLoan: () => Response;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

beforeEach(() => {
  respondToMarkOwned = () => jsonResponse(makeBookView({ ownershipStatus: "owned" }));
  respondToReturnLoan = () => jsonResponse(makeBookView({ ownershipStatus: "owned" }));
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/store-links") && method === "GET")
      return Promise.resolve(jsonResponse({ bestOffer: null, storeLinks: [] }));
    if (url.includes("/loan/return") && method === "POST")
      return Promise.resolve(respondToReturnLoan());
    if (url.includes("/ownership/mark-owned") && method === "POST")
      return Promise.resolve(respondToMarkOwned());
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("OwnershipBlock direct action errors", () => {
  it("explains in Ukrainian that a book nobody lent cannot be returned", async () => {
    respondToReturnLoan = () =>
      jsonResponse(
        { code: LOAN_ERROR_CODES.returnRequiresLoan, message: SERVER_MESSAGES.notOnLoan },
        409,
      );
    renderWithProviders(
      <OwnershipBlock
        book={makeBookView({ loanInfo: null, ownershipStatus: "lent_to_someone" })}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: ownershipMessages.actions.return }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(loanErrors.returnRequiresLoan));
    expect(toast.error).not.toHaveBeenCalledWith(SERVER_MESSAGES.notOnLoan);
  });

  it("falls back to the translated update error when marking owned fails without a code", async () => {
    respondToMarkOwned = () => jsonResponse({ message: SERVER_MESSAGES.alreadyOwned }, 409);
    renderWithProviders(
      <OwnershipBlock book={makeBookView({ ownershipStatus: "none", purchaseInfo: null })} />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: ownershipMessages.actions.markOwned }),
    );

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(ownershipMessages.toast.error));
    expect(toast.error).not.toHaveBeenCalledWith(SERVER_MESSAGES.alreadyOwned);
  });
});
