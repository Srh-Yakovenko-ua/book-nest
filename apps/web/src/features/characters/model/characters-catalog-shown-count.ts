type HeldCatalogPage = {
  items: readonly unknown[];
  page: number;
  pageSize: number;
  totalCount: number;
};

type ShownCharactersCount = {
  shown: number;
  total: number;
};

export function countShownCharacters(pages: readonly HeldCatalogPage[]): ShownCharactersCount {
  const lastPage = pages.at(-1);
  if (lastPage === undefined) return { shown: 0, total: 0 };
  return {
    shown: Math.min(
      lastPage.totalCount,
      (lastPage.page - 1) * lastPage.pageSize + lastPage.items.length,
    ),
    total: lastPage.totalCount,
  };
}
