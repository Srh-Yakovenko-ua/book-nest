import type {
  ApplySeriesOrderFixResponse,
  SeriesOrderFixInput,
  SeriesOrderFixPreviewView,
  SeriesOrderIssuesView,
  SeriesOrderPreferenceView,
} from "@app/shared";

import {
  ApplySeriesOrderFixResponseSchema,
  SeriesOrderFixPreviewViewSchema,
  SeriesOrderIssuesViewSchema,
  SeriesOrderPreferenceViewSchema,
} from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ApiError } from "@/lib/http-client";

import { seriesKeys } from "@/features/series/api/series-keys";
import {
  getReadingQueueControllerGetQueueQueryKey,
  getSeriesOrderCheckControllerListIssuesQueryKey,
  seriesOrderCheckControllerApplyFix,
  seriesOrderCheckControllerIgnoreIssue,
  useSeriesOrderCheckControllerListIssues,
  useSeriesOrderCheckControllerPreviewFix,
} from "@/shared/api/generated/endpoints/reading-queue/reading-queue";
import {
  getSeriesOrderPreferenceControllerGetPreferenceQueryKey,
  seriesOrderPreferenceControllerSetPreference,
  useSeriesOrderPreferenceControllerGetPreference,
} from "@/shared/api/generated/endpoints/series/series";

import type { SeriesOrderFixTarget } from "../model/series-order-check";

import { bookKeys } from "./book-keys";

const seriesOrderIssuesRootKey = getSeriesOrderCheckControllerListIssuesQueryKey();

export function useApplySeriesOrderFix() {
  const queryClient = useQueryClient();

  return useMutation<
    ApplySeriesOrderFixResponse,
    ApiError,
    { fingerprint: string; input: SeriesOrderFixInput }
  >({
    mutationFn: async ({ fingerprint, input }) =>
      ApplySeriesOrderFixResponseSchema.parse(
        await seriesOrderCheckControllerApplyFix(fingerprint, input),
      ),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: seriesOrderIssuesRootKey });
      void queryClient.invalidateQueries({ queryKey: getReadingQueueControllerGetQueueQueryKey() });
      void queryClient.invalidateQueries({ queryKey: bookKeys.root });
      void queryClient.invalidateQueries({ queryKey: seriesKeys.root });
    },
  });
}

export function useIgnoreSeriesOrderIssue() {
  const queryClient = useQueryClient();

  return useMutation<SeriesOrderIssuesView, ApiError, string>({
    mutationFn: async (fingerprint) =>
      SeriesOrderIssuesViewSchema.parse(await seriesOrderCheckControllerIgnoreIssue(fingerprint)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: seriesOrderIssuesRootKey }),
  });
}

export function useInvalidateSeriesOrderIssues() {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: seriesOrderIssuesRootKey });
}

export function useSeriesOrderCheckPreference(seriesId: string) {
  return useSeriesOrderPreferenceControllerGetPreference<SeriesOrderPreferenceView, ApiError>(
    seriesId,
    { query: { select: (data: unknown) => SeriesOrderPreferenceViewSchema.parse(data) } },
  );
}

export function useSeriesOrderFixPreview(target: SeriesOrderFixTarget) {
  return useSeriesOrderCheckControllerPreviewFix<SeriesOrderFixPreviewView, ApiError>(
    target.fingerprint,
    { expectedQueueVersion: target.queueVersion, strategy: target.strategy },
    {
      query: {
        gcTime: 0,
        retry: false,
        select: (data: unknown) => SeriesOrderFixPreviewViewSchema.parse(data),
        staleTime: 0,
      },
    },
  );
}

export function useSeriesOrderIssues({
  enabled = true,
  limit,
}: {
  enabled?: boolean;
  limit: number;
}) {
  return useSeriesOrderCheckControllerListIssues(
    { limit },
    { query: { enabled, select: (data: unknown) => SeriesOrderIssuesViewSchema.parse(data) } },
  );
}

export function useSetSeriesOrderCheckPreference() {
  const queryClient = useQueryClient();

  return useMutation<SeriesOrderPreferenceView, ApiError, { enabled: boolean; seriesId: string }>({
    mutationFn: async ({ enabled, seriesId }) =>
      SeriesOrderPreferenceViewSchema.parse(
        await seriesOrderPreferenceControllerSetPreference(seriesId, { enabled }),
      ),
    onSuccess: (_data, { seriesId }) => {
      void queryClient.invalidateQueries({ queryKey: seriesOrderIssuesRootKey });
      void queryClient.invalidateQueries({
        queryKey: getSeriesOrderPreferenceControllerGetPreferenceQueryKey(seriesId),
      });
    },
  });
}
