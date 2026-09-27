export function hasValues<TValue>(values: TValue[] | undefined): values is TValue[] {
  return values !== undefined && values.length > 0;
}
