export function assertNotStale({
  actual,
  expected,
  toError,
}: {
  actual: Date;
  expected: string | undefined;
  toError: () => Error;
}): void {
  if (expected !== undefined && actual.toISOString() !== expected) {
    throw toError();
  }
}
