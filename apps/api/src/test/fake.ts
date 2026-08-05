import type { ExecutionContext } from "@nestjs/common";

export function fakeExecutionContext({
  request,
  response,
}: {
  request: unknown;
  response: unknown;
}): ExecutionContext {
  const http = fakeOf<ReturnType<ExecutionContext["switchToHttp"]>>({
    getRequest: <T>(): T => request as T,
    getResponse: <T>(): T => response as T,
  });
  return fakeOf<ExecutionContext>({ switchToHttp: () => http });
}

export function fakeOf<T>(impl: Partial<T> = {}): T {
  return impl as T;
}
