import type { Nullable } from "@app/shared";

import { createLogger } from "./logger.js";

export type KeysetScanSummary = {
  pages: number;
  visited: number;
};

export async function scanByKeyset<TItem>({
  loadPage,
  maxPages,
  pageSize,
  scope,
  toCursor,
  visitPage,
}: {
  loadPage: (cursor: Nullable<string>) => Promise<TItem[]>;
  maxPages: number;
  pageSize: number;
  scope: string;
  toCursor: (item: TItem) => string;
  visitPage: (items: TItem[]) => Promise<void>;
}): Promise<KeysetScanSummary> {
  let cursor: Nullable<string> = null;
  let visited = 0;

  for (let page = 1; page <= maxPages; page += 1) {
    const items = await loadPage(cursor);
    if (items.length === 0) {
      return { pages: page, visited };
    }

    await visitPage(items);
    visited += items.length;

    const lastItem = items.at(-1);
    if (items.length < pageSize || lastItem === undefined) {
      return { pages: page, visited };
    }
    cursor = toCursor(lastItem);
  }

  createLogger(scope).error(
    { maxPages, pageSize, visited },
    "keyset scan hit its page cap and left work unprocessed in this tick",
  );
  return { pages: maxPages, visited };
}
