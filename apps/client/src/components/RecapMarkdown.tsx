import type { ReactNode } from "react";
import WikiInlineText from "./WikiInlineText";
import type { WikiEntityIndex } from "../lib/wikiLinks";

type RenderRecapMarkdownOptions = {
  entityIndex: WikiEntityIndex;
};

function renderInlineMarkdown(text: string, options: RenderRecapMarkdownOptions) {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let matchIndex = 0;
  let match: RegExpExecArray | null = pattern.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      nodes.push(
        <WikiInlineText
          key={`wiki-text-${matchIndex}`}
          text={text.slice(lastIndex, match.index)}
          entityIndex={options.entityIndex}
        />,
      );
    }

    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong key={`strong-${matchIndex}`}>
          <WikiInlineText text={token.slice(2, -2)} entityIndex={options.entityIndex} />
        </strong>,
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(
        <em key={`em-${matchIndex}`}>
          <WikiInlineText text={token.slice(1, -1)} entityIndex={options.entityIndex} />
        </em>,
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(<code key={`code-${matchIndex}`}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        nodes.push(
          <a key={`link-${matchIndex}`} href={linkMatch[2]} target="_blank" rel="noreferrer">
            {linkMatch[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    } else {
      nodes.push(token);
    }

    lastIndex = match.index + token.length;
    matchIndex += 1;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(<WikiInlineText key="wiki-tail" text={text.slice(lastIndex)} entityIndex={options.entityIndex} />);
  }

  return nodes;
}

export function renderRecapMarkdown(content: string, options: RenderRecapMarkdownOptions) {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      i += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const headingTag = `h${level}` as "h1" | "h2" | "h3" | "h4";
      const HeadingTag = headingTag;
      blocks.push(<HeadingTag key={`h-${key++}`}>{renderInlineMarkdown(text, options)}</HeadingTag>);
      i += 1;
      continue;
    }

    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push(
        <blockquote key={`q-${key++}`}>{renderInlineMarkdown(quoteLines.join(" "), options)}</blockquote>,
      );
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      const items: ReactNode[] = [];
      while (i < lines.length) {
        const itemMatch = lines[i].trim().match(/^[-*]\s+(.+)$/);
        if (!itemMatch) break;
        items.push(<li key={`ul-item-${key++}`}>{renderInlineMarkdown(itemMatch[1], options)}</li>);
        i += 1;
      }
      blocks.push(<ul key={`ul-${key++}`}>{items}</ul>);
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      const items: ReactNode[] = [];
      while (i < lines.length) {
        const itemMatch = lines[i].trim().match(/^\d+\.\s+(.+)$/);
        if (!itemMatch) break;
        items.push(<li key={`ol-item-${key++}`}>{renderInlineMarkdown(itemMatch[1], options)}</li>);
        i += 1;
      }
      blocks.push(<ol key={`ol-${key++}`}>{items}</ol>);
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length && lines[i].trim()) {
      paragraphLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push(<p key={`p-${key++}`}>{renderInlineMarkdown(paragraphLines.join(" "), options)}</p>);
  }

  return blocks.length ? blocks : [<p key="empty">{content}</p>];
}
