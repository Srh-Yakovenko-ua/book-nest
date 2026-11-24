export type SettledSources<TSource extends string, TData> = {
  failures: SourceFailure<TSource>[];
  values: SourceValue<TSource, TData>[];
};

export type SourceFailure<TSource extends string> = {
  error: unknown;
  source: TSource;
};

export type SourceTask<TSource extends string, TData> = {
  load: () => Promise<TData>;
  source: TSource;
};

export type SourceValue<TSource extends string, TData> = {
  data: TData;
  source: TSource;
};

export function rethrowWhenAllRejected(results: readonly PromiseSettledResult<unknown>[]): void {
  if (results.some((result) => result.status === "fulfilled")) {
    return;
  }
  const [first] = results;
  if (first?.status === "rejected") {
    throw first.reason;
  }
}

export async function settleSources<TSource extends string, TData>(
  tasks: readonly SourceTask<TSource, TData>[],
): Promise<SettledSources<TSource, TData>> {
  const results = await Promise.allSettled(tasks.map((task) => task.load()));
  const settled: SettledSources<TSource, TData> = { failures: [], values: [] };

  results.forEach((result, index) => {
    const task = tasks[index];
    if (task === undefined) {
      return;
    }
    if (result.status === "fulfilled") {
      settled.values.push({ data: result.value, source: task.source });
      return;
    }
    settled.failures.push({ error: result.reason, source: task.source });
  });

  return settled;
}
