import type { ReactNode } from "react";

import type { LegalBlock, LegalDocumentContent } from "../content/types";

const INLINE_PATTERN = /\*\*(?<strong>[^*]+)\*\*|`(?<code>[^`]+)`/g;

export function LegalDocument({ lastUpdated, lead, sections, title }: LegalDocumentContent) {
  return (
    <article className="flex flex-col gap-10">
      <header className="flex flex-col gap-3 border-b border-border pb-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{lastUpdated}</p>
        {lead.map((paragraph) => (
          <p className="leading-relaxed text-muted-foreground" key={paragraph}>
            {renderInline(paragraph)}
          </p>
        ))}
      </header>

      {sections.map((section) => (
        <section className="scroll-mt-24" id={section.id} key={section.id}>
          <h2 className="mb-4 font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {section.heading}
          </h2>
          <div className="flex flex-col gap-4">
            {section.blocks.map((block, blockIndex) => (
              <LegalBlockView block={block} key={`${section.id}-${blockIndex}`} />
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}

function LegalBlockView({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "list":
      return (
        <ul className="flex list-disc flex-col gap-2 pl-5 leading-relaxed text-foreground marker:text-muted-foreground">
          {block.items.map((item) => (
            <li key={item}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case "paragraph":
      return <p className="leading-relaxed text-foreground">{renderInline(block.text)}</p>;
    case "subheading":
      return <h3 className="font-semibold text-foreground">{renderInline(block.text)}</h3>;
  }
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let index = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const start = match.index;
    if (start > cursor) {
      nodes.push(text.slice(cursor, start));
    }

    const { code, strong } = match.groups ?? {};
    if (strong !== undefined) {
      nodes.push(
        <strong className="font-semibold text-foreground" key={index}>
          {strong}
        </strong>,
      );
    } else if (code !== undefined) {
      nodes.push(
        <code
          className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground"
          key={index}
        >
          {code}
        </code>,
      );
    }

    cursor = start + match[0].length;
    index += 1;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}
