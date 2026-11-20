import type { TestContext } from "vitest";

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect } from "vitest";

const unstubbedRequests: string[] = [];

const FINISHED_TEST_STATES: ReadonlySet<string> = new Set(["fail", "pass"]);

let currentTest: TestContext["task"] | undefined;

function describeRequest(input: RequestInfo | URL, init?: RequestInit): string {
  if (input instanceof Request) return `${init?.method ?? input.method} ${input.url}`;
  return `${init?.method ?? "GET"} ${String(input)}`;
}

function isTearingDownTest(): boolean {
  return FINISHED_TEST_STATES.has(currentTest?.result?.state ?? "");
}

beforeEach((context) => {
  currentTest = context.task;
});

window.fetch = (input, init) => {
  const request = describeRequest(input, init);
  if (!isTearingDownTest()) {
    const testName = expect.getState().currentTestName ?? "outside any test";
    unstubbedRequests.push(`${request} from "${testName}"`);
  }
  return Promise.reject(new Error(`Unstubbed fetch: ${request}. Stub this request in the test.`));
};

const happyDomGetComputedStyle = window.getComputedStyle.bind(window);

window.getComputedStyle = (element, pseudoElement) =>
  new Proxy(happyDomGetComputedStyle(element, pseudoElement), {
    get: (style, property) =>
      property === "transform"
        ? style.getPropertyValue("transform") || "none"
        : Reflect.get(style, property),
  });

afterEach(() => {
  cleanup();
  const requests = unstubbedRequests.splice(0);
  if (requests.length === 0) return;
  throw new Error(`The test sent fetch requests nobody stubbed:\n${requests.join("\n")}`);
});
