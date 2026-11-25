import type { SettingsView, UpdateSettingsInput } from "@app/shared";

import {
  defaultUserProfileSettings,
  SettingsViewSchema,
  UpdateSettingsInputSchema,
} from "@app/shared";
import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { queryClientWrapper } from "@/test-query-cache";
import { createTestQueryClient, waitFor } from "@/test-utils";

import { useSettings } from "../api/use-settings";
import { useAutosaveField } from "./use-autosave-field";

type PatchAnswer = (input: UpdateSettingsInput) => Promise<Response>;

const BODIES = {
  timezone: { timezone: "Europe/Warsaw" },
  weekStartDay: { weekStartDay: "sunday" },
} as const;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

const server: { answers: PatchAnswer[]; settings: SettingsView } = {
  answers: [],
  settings: defaultUserProfileSettings,
};

function failedSave(): Promise<Response> {
  return Promise.resolve(jsonResponse({ message: "Internal server error" }, 500));
}

function holdPatch(answer: PatchAnswer): () => void {
  let release: () => void = () => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.answers.push(async (input) => {
    await released;
    return answer(input);
  });
  return release;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

async function loadedFields() {
  const { result } = renderHook(() => useRegionalFields(), {
    wrapper: queryClientWrapper(createTestQueryClient()),
  });
  await waitFor(() => expect(result.current.isLoaded).toBe(true));
  return result;
}

function patchBodies(): unknown[] {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method === "PATCH")
    .map(([, init]): unknown => JSON.parse(String(init?.body)));
}

function respondToSettings(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  if (!url.includes("/api/profile/settings")) {
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  }
  if (init?.method !== "PATCH") return Promise.resolve(jsonResponse(server.settings));

  const answer = server.answers.shift() ?? savedSettings;
  return answer(UpdateSettingsInputSchema.parse(JSON.parse(String(init.body))));
}

function savedSettings(input: UpdateSettingsInput): Promise<Response> {
  server.settings = SettingsViewSchema.parse({ ...server.settings, ...input });
  return Promise.resolve(jsonResponse(server.settings));
}

function useRegionalFields() {
  const settings = useSettings();
  const confirmed = settings.data ?? defaultUserProfileSettings;

  const timezone = useAutosaveField({
    confirmed: confirmed.timezone,
    fromInput: (input) => input.timezone,
    toInput: (next) => ({ timezone: next }),
  });
  const weekStartDay = useAutosaveField({
    confirmed: confirmed.weekStartDay,
    fromInput: (input) => input.weekStartDay,
    toInput: (next) => ({ weekStartDay: next }),
  });

  return { isLoaded: settings.isSuccess, timezone, weekStartDay };
}

beforeEach(() => {
  server.answers = [];
  server.settings = defaultUserProfileSettings;
  fetchMock.mockReset();
  fetchMock.mockImplementation(respondToSettings);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useAutosaveField", () => {
  it("sends no request when the chosen value is already displayed", async () => {
    const fields = await loadedFields();

    act(() => fields.current.timezone.save("Europe/Kyiv"));
    act(() => fields.current.timezone.save("Europe/Warsaw"));

    await waitFor(() => expect(patchBodies()).toEqual([BODIES.timezone]));
  });

  it("shows the pending value as saving while the PATCH is in flight", async () => {
    holdPatch(savedSettings);
    const fields = await loadedFields();

    act(() => fields.current.timezone.save("Europe/Warsaw"));

    await waitFor(() => expect(fields.current.timezone.status).toBe("saving"));
    expect(fields.current.timezone.value).toBe("Europe/Warsaw");
  });

  it("shows the saved server value once the PATCH succeeds", async () => {
    const fields = await loadedFields();

    act(() => fields.current.timezone.save("Europe/Warsaw"));

    await waitFor(() => expect(fields.current.timezone.status).toBe("saved"));
    expect(fields.current.timezone.value).toBe("Europe/Warsaw");
  });

  it("holds the second field's PATCH until the first one resolves", async () => {
    const releaseFirst = holdPatch(savedSettings);
    const fields = await loadedFields();

    act(() => {
      fields.current.timezone.save("Europe/Warsaw");
      fields.current.weekStartDay.save("sunday");
    });
    await waitFor(() => expect(fields.current.weekStartDay.status).toBe("saving"));
    expect(patchBodies()).toEqual([BODIES.timezone]);

    releaseFirst();

    await waitFor(() => expect(patchBodies()).toEqual([BODIES.timezone, BODIES.weekStartDay]));
  });

  it("keeps the queued field's choice after the earlier save refreshes the cache", async () => {
    const releaseFirst = holdPatch(savedSettings);
    holdPatch(savedSettings);
    const fields = await loadedFields();

    act(() => {
      fields.current.timezone.save("Europe/Warsaw");
      fields.current.weekStartDay.save("sunday");
    });
    releaseFirst();

    await waitFor(() => expect(fields.current.timezone.status).toBe("saved"));
    expect(fields.current.weekStartDay.value).toBe("sunday");
  });

  it("still sends and saves the queued field after the earlier save fails", async () => {
    const releaseFirst = holdPatch(failedSave);
    const fields = await loadedFields();

    act(() => {
      fields.current.timezone.save("Europe/Warsaw");
      fields.current.weekStartDay.save("sunday");
    });
    releaseFirst();

    await waitFor(() => expect(fields.current.weekStartDay.status).toBe("saved"));
    expect(fields.current.weekStartDay.value).toBe("sunday");
  });

  it("returns only the failed field to its confirmed value with an error status", async () => {
    const releaseFirst = holdPatch(failedSave);
    const fields = await loadedFields();

    act(() => {
      fields.current.timezone.save("Europe/Warsaw");
      fields.current.weekStartDay.save("sunday");
    });
    releaseFirst();
    await waitFor(() => expect(fields.current.weekStartDay.status).toBe("saved"));

    expect(fields.current.timezone.status).toBe("error");
    expect(fields.current.timezone.value).toBe("Europe/Kyiv");
  });

  it("re-sends the failed partial body on retry", async () => {
    server.answers.push(failedSave);
    const fields = await loadedFields();

    act(() => fields.current.timezone.save("Europe/Warsaw"));
    await waitFor(() => expect(fields.current.timezone.status).toBe("error"));
    act(() => fields.current.timezone.retry());

    await waitFor(() => expect(patchBodies()).toEqual([BODIES.timezone, BODIES.timezone]));
  });

  it("clears the error once the retried save succeeds", async () => {
    server.answers.push(failedSave);
    const fields = await loadedFields();

    act(() => fields.current.timezone.save("Europe/Warsaw"));
    await waitFor(() => expect(fields.current.timezone.status).toBe("error"));
    act(() => fields.current.timezone.retry());

    await waitFor(() => expect(fields.current.timezone.status).toBe("saved"));
    expect(fields.current.timezone.value).toBe("Europe/Warsaw");
  });
});
