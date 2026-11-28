export type CollectionPresence =
  { kind: "error"; retry: () => void } | { kind: "pending" } | { kind: "ready"; total: number };

type CollectionQuery<TData> = {
  data: TData | undefined;
  isLoadingError: boolean;
  isPending: boolean;
  refetch: () => Promise<unknown>;
};

export function toCollectionPresence<TData>({
  query,
  total,
}: {
  query: CollectionQuery<TData>;
  total: (data: TData) => number;
}): CollectionPresence {
  if (query.isLoadingError) return { kind: "error", retry: () => void query.refetch() };
  if (query.isPending || query.data === undefined) return { kind: "pending" };
  return { kind: "ready", total: total(query.data) };
}

export function withPresenceRetry({
  presence,
  wrapRetry,
}: {
  presence: CollectionPresence;
  wrapRetry: (retry: () => void) => () => void;
}): CollectionPresence {
  if (presence.kind !== "error") return presence;
  return { kind: "error", retry: wrapRetry(presence.retry) };
}
