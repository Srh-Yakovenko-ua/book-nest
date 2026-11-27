type CollectionChrome = {
  showMetrics: boolean;
  showTools: boolean;
};

type CollectionChromeInput = {
  baseTotal: number | undefined;
  hasQuery: boolean;
};

export function collectionChrome({ baseTotal, hasQuery }: CollectionChromeInput): CollectionChrome {
  const isBaseEmpty = baseTotal === 0;

  return {
    showMetrics: !isBaseEmpty,
    showTools: !isBaseEmpty || hasQuery,
  };
}
