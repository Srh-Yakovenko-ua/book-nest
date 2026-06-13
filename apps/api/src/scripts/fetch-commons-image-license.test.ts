import { describe, expect, it } from "vitest";

import { commonsFileTitleFromUrl, parseImageExtMetadata } from "./fetch-commons-image-license.js";

describe("commonsFileTitleFromUrl", () => {
  it("extracts the title from a Special:FilePath url", () => {
    const url = "http://commons.wikimedia.org/wiki/Special:FilePath/Taras%20Shevchenko.jpg";

    expect(commonsFileTitleFromUrl(url)).toBe("File:Taras Shevchenko.jpg");
  });

  it("extracts the title from a /wiki/File: url", () => {
    const url = "https://commons.wikimedia.org/wiki/File:Lesya_Ukrainka.jpg";

    expect(commonsFileTitleFromUrl(url)).toBe("File:Lesya_Ukrainka.jpg");
  });

  it("url-decodes encoded characters including parentheses and commas", () => {
    const url =
      "http://commons.wikimedia.org/wiki/Special:FilePath/Ivan%20Franko%20%28portrait%2C%201898%29.png";

    expect(commonsFileTitleFromUrl(url)).toBe("File:Ivan Franko (portrait, 1898).png");
  });

  it("decodes a plus-containing encoded filename without treating plus as space", () => {
    const url = "http://commons.wikimedia.org/wiki/Special:FilePath/A%2BB.jpg";

    expect(commonsFileTitleFromUrl(url)).toBe("File:A+B.jpg");
  });

  it("returns null for a non-Commons url", () => {
    expect(commonsFileTitleFromUrl("https://covers.openlibrary.org/a/id/123-L.jpg")).toBeNull();
  });

  it("returns null when the Special:FilePath segment is empty", () => {
    expect(
      commonsFileTitleFromUrl("http://commons.wikimedia.org/wiki/Special:FilePath/"),
    ).toBeNull();
  });
});

describe("parseImageExtMetadata", () => {
  it("strips HTML from a CC-BY-SA Artist credit and returns plain text", () => {
    const result = parseImageExtMetadata({
      Artist: {
        value: '<a href="//commons.wikimedia.org/wiki/User:Jane" title="Jane">Jane &amp; Co.</a>',
      },
      LicenseShortName: { value: "CC BY-SA 4.0" },
      LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0" },
    });

    expect(result).toEqual({
      attribution: "Jane & Co.",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    });
  });

  it("sets the license but leaves attribution null for a public-domain image with no Artist", () => {
    const result = parseImageExtMetadata({
      LicenseShortName: { value: "Public domain" },
      LicenseUrl: { value: "https://creativecommons.org/publicdomain/mark/1.0/" },
    });

    expect(result).toEqual({
      attribution: null,
      license: "Public domain",
      licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
    });
  });

  it("falls back to Credit when Artist is missing", () => {
    const result = parseImageExtMetadata({
      Credit: { value: "<span>National Library</span>" },
      LicenseShortName: { value: "CC BY 2.0" },
    });

    expect(result.attribution).toBe("National Library");
    expect(result.license).toBe("CC BY 2.0");
  });

  it("returns all nulls when every field is missing", () => {
    expect(parseImageExtMetadata({})).toEqual({
      attribution: null,
      license: null,
      licenseUrl: null,
    });
  });

  it("decodes numeric and named HTML entities and collapses whitespace", () => {
    const result = parseImageExtMetadata({
      Artist: { value: "  Anна   &#039;the&#039; &quot;Great&quot;  &nbsp; Poet  " },
    });

    expect(result.attribution).toBe(`Anна 'the' "Great" Poet`);
  });

  it("neutralizes an entity-encoded script tag instead of reconstituting it", () => {
    const result = parseImageExtMetadata({
      Artist: { value: "&lt;script&gt;alert(1)&lt;/script&gt;" },
    });

    const attribution = result.attribution ?? "";
    expect(attribution).not.toContain("<");
    expect(attribution).not.toContain(">");
    expect(attribution).not.toContain("<script");
  });

  it("strips an unclosed tag with no closing bracket", () => {
    const result = parseImageExtMetadata({
      Artist: { value: "<img src=x onerror=alert(1)" },
    });

    const attribution = result.attribution ?? "";
    expect(attribution).not.toContain("<");
    expect(attribution).not.toContain(">");
    expect(attribution).not.toMatch(/onerror=[<>]/);
  });

  it("neutralizes a tag-then-entity combo that would otherwise reconstitute markup", () => {
    const result = parseImageExtMetadata({
      Artist: { value: "<b>&lt;img src=x onerror=alert(1)&gt;</b>" },
    });

    const attribution = result.attribution ?? "";
    expect(attribution).not.toContain("<");
    expect(attribution).not.toContain(">");
    expect(attribution).not.toContain("<img");
    expect(attribution).not.toMatch(/onerror=[<>]/);
  });

  it("truncates an oversized attribution to the maximum length", () => {
    const result = parseImageExtMetadata({
      Artist: { value: "A".repeat(500) },
    });

    expect(result.attribution).toHaveLength(300);
  });

  it("rejects a javascript: license url and returns null", () => {
    const result = parseImageExtMetadata({
      LicenseShortName: { value: "CC BY 4.0" },
      LicenseUrl: { value: "javascript:alert(1)" },
    });

    expect(result.licenseUrl).toBeNull();
    expect(result.license).toBe("CC BY 4.0");
  });

  it("rejects a data: license url and returns null", () => {
    const result = parseImageExtMetadata({
      LicenseUrl: { value: "data:text/html,<script>alert(1)</script>" },
    });

    expect(result.licenseUrl).toBeNull();
  });

  it("keeps an http license url", () => {
    const result = parseImageExtMetadata({
      LicenseUrl: { value: "http://creativecommons.org/licenses/by/2.0/" },
    });

    expect(result.licenseUrl).toBe("http://creativecommons.org/licenses/by/2.0/");
  });

  it("keeps an https license url", () => {
    const result = parseImageExtMetadata({
      LicenseUrl: { value: "https://creativecommons.org/licenses/by/4.0/" },
    });

    expect(result.licenseUrl).toBe("https://creativecommons.org/licenses/by/4.0/");
  });

  it("returns null for a malformed license url without throwing", () => {
    const result = parseImageExtMetadata({
      LicenseUrl: { value: "not a url" },
    });

    expect(result.licenseUrl).toBeNull();
  });

  it("truncates an oversized license short name to the maximum length", () => {
    const result = parseImageExtMetadata({
      LicenseShortName: { value: "L".repeat(500) },
    });

    expect(result.license).toHaveLength(120);
  });
});
