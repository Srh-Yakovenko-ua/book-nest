import type { Nullable } from "@app/shared";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  render,
  type RenderOptions,
  type RenderResult,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import messages from "@/messages/uk.json";

type IntersectionObserverRecord = {
  callback: IntersectionObserverCallback;
  elements: Element[];
  instance: IntersectionObserver;
};

type RenderProvidersOptions = Omit<RenderOptions, "wrapper"> & {
  queryClient?: QueryClient;
};

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { gcTime: 0, retry: false, staleTime: 0 },
    },
  });
}

export function mockIntersectionObserver(): { enterViewport: () => void } {
  const observers: IntersectionObserverRecord[] = [];

  class IntersectionObserverStub implements IntersectionObserver {
    readonly root: Nullable<Document | Element> = null;
    readonly rootMargin: string = "";
    readonly scrollMargin: string = "";
    readonly thresholds: readonly number[] = [];
    private readonly record: IntersectionObserverRecord;

    constructor(callback: IntersectionObserverCallback) {
      this.record = { callback, elements: [], instance: this };
      observers.push(this.record);
    }

    disconnect() {
      const index = observers.indexOf(this.record);
      if (index >= 0) observers.splice(index, 1);
    }

    observe(element: Element) {
      this.record.elements.push(element);
    }

    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }

    unobserve(element: Element) {
      this.record.elements = this.record.elements.filter((observed) => observed !== element);
    }
  }

  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    observers.length = 0;
  });

  return {
    enterViewport() {
      act(() => {
        for (const observer of [...observers]) {
          const entries = observer.elements.map(
            (target) => ({ isIntersecting: true, target }) as IntersectionObserverEntry,
          );
          if (entries.length === 0) continue;
          observer.callback(entries, observer.instance);
        }
      });
    },
  };
}

export function renderWithProviders(
  ui: ReactElement,
  { queryClient, ...options }: RenderProvidersOptions = {},
): RenderResult & { queryClient: QueryClient } {
  const client = queryClient ?? createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="uk" messages={messages}>
        <QueryClientProvider client={client}>
          <TooltipProvider>{children}</TooltipProvider>
        </QueryClientProvider>
      </NextIntlClientProvider>
    );
  }

  const result = render(ui, { wrapper: Wrapper, ...options });
  return { ...result, queryClient: client };
}

export { cleanup, render, screen, userEvent, waitFor, within };
