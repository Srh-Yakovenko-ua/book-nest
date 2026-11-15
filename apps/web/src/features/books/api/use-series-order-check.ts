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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ApiError } from "@/lib/http-client";

import { seriesKeys } from "@/features/series/api/series-keys";
import {
  seriesOrderCheckControllerApplyFix,
  seriesOrderCheckControllerIgnoreIssue,
  seriesOrderCheckControllerListIssues,
  seriesOrderCheckControllerPreviewFix,
} from "@/shared/api/generated/endpoints/reading-queue/reading-queue";
import {
  seriesOrderPreferenceControllerGetPreference,
  seriesOrderPreferenceControllerSetPreference,
} from "@/shared/api/generated/endpoints/series/series";

import type { SeriesOrderFixTarget } from "../model/series-order-check";

import { bookChangeEffects } from "./book-change-effects";
import { readingQueueKeys } from "./reading-queue-keys";

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
      void bookChangeEffects.booksChanged(queryClient, { changes: ["queueChanged"] });
    },
  });
}

export function useIgnoreSeriesOrderIssue() {
  const queryClient = useQueryClient();

  return useMutation<SeriesOrderIssuesView, ApiError, string>({
    mutationFn: async (fingerprint) =>
      SeriesOrderIssuesViewSchema.parse(await seriesOrderCheckControllerIgnoreIssue(fingerprint)),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: readingQueueKeys.seriesOrderIssues.all }),
  });
}

export function useInvalidateSeriesOrderIssues() {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: readingQueueKeys.seriesOrderIssues.all });
}

export function useSeriesOrderCheckPreference(seriesId: string) {
  return useQuery({
    queryFn: async ({ signal }): Promise<SeriesOrderPreferenceView> =>
      SeriesOrderPreferenceViewSchema.parse(
        await seriesOrderPreferenceControllerGetPreference(seriesId, { signal }),
      ),
    queryKey: seriesKeys.orderCheckPreference(seriesId),
  });
}

export function useSeriesOrderFixPreview(target: SeriesOrderFixTarget) {
  const input: SeriesOrderFixInput = {
    expectedQueueVersion: target.queueVersion,
    strategy: target.strategy,
  };

  return useQuery({
    gcTime: 0,
    queryFn: async ({ signal }): Promise<SeriesOrderFixPreviewView> =>
      SeriesOrderFixPreviewViewSchema.parse(
        await seriesOrderCheckControllerPreviewFix(target.fingerprint, input, { signal }),
      ),
    queryKey: readingQueueKeys.seriesOrderFixPreview(target.fingerprint, input),
    retry: false,
    staleTime: 0,
  });
}

export function useSeriesOrderIssues({
  enabled = true,
  limit,
}: {
  enabled?: boolean;
  limit: number;
}) {
  return useQuery({
    enabled,
    queryFn: async ({ signal }): Promise<SeriesOrderIssuesView> =>
      SeriesOrderIssuesViewSchema.parse(
        await seriesOrderCheckControllerListIssues({ limit }, { signal }),
      ),
    queryKey: readingQueueKeys.seriesOrderIssues.list({ limit }),
  });
}

export function useSetSeriesOrderCheckPreference() {
  const queryClient = useQueryClient();

  return useMutation<SeriesOrderPreferenceView, ApiError, { enabled: boolean; seriesId: string }>({
    mutationFn: async ({ enabled, seriesId }) =>
      SeriesOrderPreferenceViewSchema.parse(
        await seriesOrderPreferenceControllerSetPreference(seriesId, { enabled }),
      ),
    onSuccess: (_data, { seriesId }) => {
      void queryClient.invalidateQueries({ queryKey: readingQueueKeys.seriesOrderIssues.all });
      void queryClient.invalidateQueries({
        queryKey: seriesKeys.orderCheckPreference(seriesId),
      });
    },
  });
}
