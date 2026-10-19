import type { MediaView, QuoteView } from "@app/shared";

type TextMetrics = Partial<Record<(typeof TEXT_METRIC_NAMES)[number], number>>;

const TEXT_METRIC_NAMES = ["clientHeight", "scrollHeight", "clientWidth", "scrollWidth"] as const;

export function makeQuote(overrides: Partial<QuoteView> = {}): QuoteView {
  return {
    book: {
      cover: null,
      firstAuthorName: "Френк Герберт",
      id: "book-1",
      title: "Дюна",
    },
    bookId: "book-1",
    chapter: "Розділ III",
    comment: null,
    createdAt: "2026-01-05T10:00:00.000Z",
    id: "quote-1",
    isFavorite: false,
    isSpoiler: false,
    page: 87,
    text: "Страх — убивця розуму.",
    updatedAt: "2026-01-05T10:00:00.000Z",
    ...overrides,
  };
}

export function makeQuoteBookCover(): MediaView {
  return {
    contentType: "image/webp",
    createdAt: "2026-01-01T00:00:00.000Z",
    height: 800,
    id: "media-1",
    kind: "book_cover",
    name: null,
    sizeBytes: 12_345,
    urls: {
      card: "https://cdn.example.com/dune-card.webp",
      full: "https://cdn.example.com/dune-full.webp",
      thumb: "https://cdn.example.com/dune-thumb.webp",
    },
    width: 600,
  };
}

export function stubTextMetrics(metrics: TextMetrics): () => void {
  const originals = TEXT_METRIC_NAMES.map(
    (name) => [name, Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)] as const,
  );

  for (const name of TEXT_METRIC_NAMES) {
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      get: () => metrics[name] ?? 0,
    });
  }

  return () => {
    for (const [name, descriptor] of originals) {
      if (descriptor === undefined) {
        Reflect.deleteProperty(HTMLElement.prototype, name);
        continue;
      }
      Object.defineProperty(HTMLElement.prototype, name, descriptor);
    }
  };
}
