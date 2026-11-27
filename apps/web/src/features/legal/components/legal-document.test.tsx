import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import type { LegalDocumentContent } from "../content/types";

import { LegalDocument } from "./legal-document";

const DOCUMENT: LegalDocumentContent = {
  lastUpdated: "Оновлено 1 листопада 2026",
  lead: ["Ця політика пояснює, які дані зберігає бібліотека."],
  sections: [
    {
      blocks: [{ kind: "paragraph", text: "Ми зберігаємо лише адресу пошти та каталог." }],
      heading: "Які дані ми збираємо",
      id: "data",
    },
    {
      blocks: [
        { kind: "subheading", text: "Доступ і видалення" },
        { items: ["Експорт каталогу", "Видалення облікового запису"], kind: "list" },
      ],
      heading: "Ваші права",
      id: "rights",
    },
  ],
  title: "Політика конфіденційності",
};

function showDocument() {
  renderWithProviders(<LegalDocument {...DOCUMENT} />);
}

describe("LegalDocument illustration", () => {
  it("decorates the header with the sprouting book art", () => {
    showDocument();

    expect(screen.getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining("line-book-sprout.png"),
    );
  });

  it("places the art before the document title", () => {
    showDocument();

    const title = screen.getByRole("heading", { level: 1, name: DOCUMENT.title });
    expect(screen.getByRole("presentation").compareDocumentPosition(title)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});

describe("LegalDocument headings", () => {
  it("keeps the title as the only h1 and every section as an h2", () => {
    showDocument();

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(["Які дані ми збираємо", "Ваші права"]);
  });
});
