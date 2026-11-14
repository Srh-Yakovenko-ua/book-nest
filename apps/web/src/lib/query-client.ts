import { isServer, QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/http-client";

const QUERY_RETRY = {
  maxRetries: 1,
  retryableClientStatuses: new Set([408, 429]),
  serverErrorStatusMin: 500,
} as const;

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= QUERY_RETRY.maxRetries) return false;
  if (error instanceof ApiError) {
    return (
      error.status >= QUERY_RETRY.serverErrorStatusMin ||
      QUERY_RETRY.retryableClientStatuses.has(error.status)
    );
  }
  return error instanceof TypeError;
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
      queries: {
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
        staleTime: 30_000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
