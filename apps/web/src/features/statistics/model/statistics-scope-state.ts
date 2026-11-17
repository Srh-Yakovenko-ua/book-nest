export type StatisticsQueryLike<TData> = {
  data: TData | undefined;
  isError: boolean;
  isFetching: boolean;
  isPlaceholderData: boolean;
  refetch: () => unknown;
};

export type StatisticsScopeState<TData> = {
  data: TData | undefined;
  isInitialError: boolean;
  isInitialLoading: boolean;
  isPlaceholderData: boolean;
  isRefetchError: boolean;
  isRefreshing: boolean;
  retry: () => void;
};

export function toStatisticsScopeState<TData>(
  query: StatisticsQueryLike<TData>,
): StatisticsScopeState<TData> {
  const hasUsableData = query.data !== undefined;

  return {
    data: query.data,
    isInitialError: query.isError && !hasUsableData,
    isInitialLoading: !hasUsableData && !query.isError,
    isPlaceholderData: query.isPlaceholderData,
    isRefetchError: query.isError && hasUsableData,
    isRefreshing: query.isFetching && hasUsableData,
    retry: () => void query.refetch(),
  };
}
