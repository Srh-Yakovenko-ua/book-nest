import type { Locale } from "@/i18n/routing";

export type LegalBlock =
  | { items: string[]; kind: "list" }
  | { kind: "paragraph"; text: string }
  | { kind: "subheading"; text: string };

export type LegalDocumentContent = {
  lastUpdated: string;
  lead: string[];
  sections: LegalSection[];
  title: string;
};

export type LegalDocumentDictionary = Record<Locale, LegalDocumentContent>;

export type LegalSection = {
  blocks: LegalBlock[];
  heading: string;
  id: string;
};
