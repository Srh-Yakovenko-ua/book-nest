import type { MediaView } from "@app/shared";
import type { ReactNode } from "react";

import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/http-client";
import { createTestQueryClient } from "@/test-utils";

import { useUploadMedia } from "./use-upload-media";

const validView: MediaView = {
  contentType: "image/webp",
  createdAt: "2026-06-27T00:00:00.000Z",
  height: 1600,
  id: "media-1",
  kind: "book_cover",
  name: "cover.webp",
  sizeBytes: 234567,
  urls: {
    card: "https://media.dev.book-nest.net/cover-card.webp",
    full: "https://media.dev.book-nest.net/cover-full.webp",
    thumb: "https://media.dev.book-nest.net/cover-thumb.webp",
  },
  width: 1066,
};

const fetchMock = vi.fn();

function coverFile() {
  return new File(["cover-bytes"], "cover.webp", { type: "image/webp" });
}

function createWrapper() {
  const queryClient = createTestQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useUploadMedia", () => {
  it("posts the file and default kind as multipart form data to /api/media", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(validView, 201));
    const file = coverFile();

    const { result } = renderHook(() => useUploadMedia(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({ file });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [url, init] = fetchMock.mock.lastCall as [string, RequestInit];
    expect(url).toBe("/api/media");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);

    const body = init.body as FormData;
    expect(body.get("kind")).toBe("book_cover");
    const filePart = body.get("file") as File;
    expect(filePart).toBeInstanceOf(File);
    expect(filePart.name).toBe("cover.webp");
  });

  it("returns the parsed media view on a successful upload", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(validView, 201));

    const { result } = renderHook(() => useUploadMedia(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({ file: coverFile() });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(validView);
  });

  it("sends the requested kind when provided", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...validView, kind: "avatar" }, 201));

    const { result } = renderHook(() => useUploadMedia(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({ file: coverFile(), kind: "avatar" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [, init] = fetchMock.mock.lastCall as [string, RequestInit];
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("kind")).toBe("avatar");
  });

  it("surfaces an ApiError when the server responds with an error", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Upload failed" }, 500));

    const { result } = renderHook(() => useUploadMedia(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({ file: coverFile() });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    const error = result.current.error as ApiError | null;
    expect(error).toBeInstanceOf(ApiError);
    expect(error?.status).toBe(500);
  });

  it("errors when the server returns a malformed media view", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "media-1", kind: "book_cover" }, 201));

    const { result } = renderHook(() => useUploadMedia(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({ file: coverFile() });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
