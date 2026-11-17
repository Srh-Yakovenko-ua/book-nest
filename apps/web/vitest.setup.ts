import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";

const unstubbedRequests: string[] = [];

function describeRequest(input: RequestInfo | URL, init?: RequestInit): string {
  if (input instanceof Request) return `${init?.method ?? input.method} ${input.url}`;
  return `${init?.method ?? "GET"} ${String(input)}`;
}

window.fetch = (input, init) => {
  const request = describeRequest(input, init);
  const testName = expect.getState().currentTestName ?? "outside any test";
  unstubbedRequests.push(`${request} from "${testName}"`);
  return Promise.reject(new Error(`Unstubbed fetch: ${request}. Stub this request in the test.`));
};

const happyDomGetComputedStyle = window.getComputedStyle.bind(window);

window.getComputedStyle = (element, pseudoElement) => {
  const style = happyDomGetComputedStyle(element, pseudoElement);
  Object.defineProperty(style, "transform", {
    configurable: true,
    get: () => style.getPropertyValue("transform") || "none",
  });
  return style;
};

afterEach(() => {
  cleanup();
  const requests = unstubbedRequests.splice(0);
  if (requests.length === 0) return;
  throw new Error(`The test sent fetch requests nobody stubbed:\n${requests.join("\n")}`);
});
