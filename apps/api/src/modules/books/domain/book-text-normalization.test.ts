import {
  BookDescriptionSchema,
  BookTitleSchema,
  collapseHorizontalSpaces,
  collapseSpaces,
  noHtmlTags,
  TagNameSchema,
  TaxonomyNameSchema,
} from "@app/shared";
import { describe, expect, it } from "vitest";

describe("collapseSpaces", () => {
  it("collapses every run of whitespace, including newlines, to a single space and trims", () => {
    expect(collapseSpaces("Сара Дж.  Маас")).toBe("Сара Дж. Маас");
    expect(collapseSpaces("  slow\t\n  burn  ")).toBe("slow burn");
  });
});

describe("collapseHorizontalSpaces", () => {
  it("collapses spaces and tabs but preserves newlines", () => {
    expect(collapseHorizontalSpaces("Line one\n\nLine   two")).toBe("Line one\n\nLine two");
    expect(collapseHorizontalSpaces("  a   b  ")).toBe("a b");
  });

  it("keeps a single newline between collapsed words", () => {
    expect(collapseHorizontalSpaces("a  b\nc   d")).toBe("a b\nc d");
  });
});

describe("noHtmlTags", () => {
  it("rejects real opening, closing and self-describing tags", () => {
    expect(noHtmlTags("<script>alert(1)</script>")).toBe(false);
    expect(noHtmlTags("a <b>bold</b> word")).toBe(false);
    expect(noHtmlTags("<img src=x onerror=1>")).toBe(false);
    expect(noHtmlTags("</p>")).toBe(false);
    expect(noHtmlTags("<!-- comment -->")).toBe(false);
  });

  it("accepts a bare less-than sign that is not a tag", () => {
    expect(noHtmlTags("Book <3")).toBe(true);
    expect(noHtmlTags("a < b")).toBe(true);
    expect(noHtmlTags("5<10")).toBe(true);
    expect(noHtmlTags("x < y and y > x")).toBe(true);
  });
});

describe("book text schemas", () => {
  it("collapses internal whitespace in single-line book fields", () => {
    expect(BookTitleSchema.parse("  The   Assassin's    Blade  ")).toBe("The Assassin's Blade");
    expect(TaxonomyNameSchema.parse("Сара Дж.  Маас")).toBe("Сара Дж. Маас");
    expect(TagNameSchema.parse("slow   burn")).toBe("slow burn");
  });

  it("preserves newlines in the multi-line description while collapsing horizontal runs", () => {
    expect(BookDescriptionSchema.parse("Line one\n\nLine   two")).toBe("Line one\n\nLine two");
  });

  it("rejects a title with an HTML tag but accepts a bare less-than sign", () => {
    expect(() => BookTitleSchema.parse("Dune <script>")).toThrow();
    expect(BookTitleSchema.parse("Book <3 forever")).toBe("Book <3 forever");
  });
});
