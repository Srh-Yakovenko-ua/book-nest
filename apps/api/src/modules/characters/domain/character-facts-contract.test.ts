import {
  CharacterFactsQuerySchema,
  CreateCharacterFactInputSchema,
  UpdateCharacterFactInputSchema,
} from "@app/shared";
import { describe, expect, it } from "vitest";

const validCreate = { text: "Has a scar shaped like lightning", title: "Scar" };

function createWith(overrides: Record<string, unknown>) {
  return CreateCharacterFactInputSchema.safeParse({ ...validCreate, ...overrides });
}

describe("CreateCharacterFactInputSchema", () => {
  it("accepts a minimal fact and trims title and text", () => {
    const result = CreateCharacterFactInputSchema.safeParse({
      text: "  Lives under the stairs  ",
      title: "  Home  ",
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ text: "Lives under the stairs", title: "Home" });
  });

  it("rejects a title that is blank after trimming", () => {
    expect(createWith({ title: "   " }).success).toBe(false);
  });

  it("rejects a text that is blank after trimming", () => {
    expect(createWith({ text: " \n\t " }).success).toBe(false);
  });

  it("accepts a 120 character title", () => {
    expect(createWith({ title: "t".repeat(120) }).success).toBe(true);
  });

  it("rejects a 121 character title", () => {
    expect(createWith({ title: "t".repeat(121) }).success).toBe(false);
  });

  it("accepts a 5000 character text", () => {
    expect(createWith({ text: "x".repeat(5000) }).success).toBe(true);
  });

  it("rejects a 5001 character text", () => {
    expect(createWith({ text: "x".repeat(5001) }).success).toBe(false);
  });

  it("accepts a 100 character chapter", () => {
    expect(createWith({ chapter: "c".repeat(100) }).success).toBe(true);
  });

  it("rejects a 101 character chapter", () => {
    expect(createWith({ chapter: "c".repeat(101) }).success).toBe(false);
  });

  it.each([0, -1, 1.5, 2_147_483_648])("rejects page %s", (page) => {
    expect(createWith({ page }).success).toBe(false);
  });

  it("accepts the largest int4 page", () => {
    expect(createWith({ page: 2_147_483_647 }).data?.page).toBe(2_147_483_647);
  });

  it.each(["", "   "])("turns chapter %j into null", (chapter) => {
    expect(createWith({ chapter }).data?.chapter).toBeNull();
  });

  it("rejects an unknown key", () => {
    expect(createWith({ bookCharacterId: "11111111-1111-4111-8111-111111111111" }).success).toBe(
      false,
    );
  });
});

describe("UpdateCharacterFactInputSchema", () => {
  it("rejects an empty update", () => {
    expect(UpdateCharacterFactInputSchema.safeParse({}).success).toBe(false);
  });

  it("accepts an update of a single field", () => {
    expect(UpdateCharacterFactInputSchema.safeParse({ title: "Renamed" }).data).toEqual({
      title: "Renamed",
    });
  });

  it.each([
    ["title", null],
    ["title", "   "],
    ["text", null],
    ["text", "   "],
  ])("rejects setting %s to %j", (field, value) => {
    expect(UpdateCharacterFactInputSchema.safeParse({ [field]: value }).success).toBe(false);
  });

  it("allows clearing chapter and page with null", () => {
    expect(UpdateCharacterFactInputSchema.safeParse({ chapter: null, page: null }).data).toEqual({
      chapter: null,
      page: null,
    });
  });

  it("rejects an unknown key", () => {
    expect(UpdateCharacterFactInputSchema.safeParse({ isSpoiler: true }).success).toBe(false);
  });
});

describe("CharacterFactsQuerySchema", () => {
  it("defaults to the first page of 20", () => {
    expect(CharacterFactsQuerySchema.parse({})).toMatchObject({ pageNumber: 1, pageSize: 20 });
  });

  it("accepts a page size of 20", () => {
    expect(CharacterFactsQuerySchema.safeParse({ pageSize: "20" }).success).toBe(true);
  });

  it("rejects a page size above 20", () => {
    expect(CharacterFactsQuerySchema.safeParse({ pageSize: "21" }).success).toBe(false);
  });

  it("collapses inner whitespace and trims the search term", () => {
    expect(CharacterFactsQuerySchema.parse({ q: "  two   words " }).q).toBe("two words");
  });

  it("drops an all-whitespace search term", () => {
    expect(CharacterFactsQuerySchema.parse({ q: "   " }).q).toBeUndefined();
  });
});
