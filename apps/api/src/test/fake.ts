export function fakeOf<T>(impl: Partial<T> = {}): T {
  return impl as T;
}
