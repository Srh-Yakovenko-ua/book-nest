import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  render,
  type RenderOptions,
  type RenderResult,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactElement, type ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";

type RenderProvidersOptions = Omit<RenderOptions, "wrapper"> & {
  queryClient?: QueryClient;
};

type RenderRouterOptions = RenderProvidersOptions & {
  initialEntries?: string[];
};

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { gcTime: 0, retry: false, staleTime: 0 },
    },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  { queryClient, ...options }: RenderProvidersOptions = {},
): RenderResult & { queryClient: QueryClient } {
  const client = queryClient ?? createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  const result = render(ui, { wrapper: Wrapper, ...options });
  return { ...result, queryClient: client };
}

export function renderWithRouter(
  element: ReactElement,
  { initialEntries = ["/"], queryClient }: RenderRouterOptions = {},
): RenderResult & { queryClient: QueryClient } {
  const client = queryClient ?? createTestQueryClient();
  const router = createMemoryRouter([{ element, path: "/" }], { initialEntries });

  const result = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...result, queryClient: client };
}

export { cleanup, render, screen, userEvent, waitFor, within };
