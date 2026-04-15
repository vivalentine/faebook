import type { ReactNode } from "react";
import WikiInlineText from "./WikiInlineText";
import type { WikiEntityIndex } from "../lib/wikiLinks";

type RenderRecapMarkdownOptions = {
  entityIndex: WikiEntityIndex;
};

function renderInlineMarkdown(text: string, options: RenderRecapMarkdownOptions) {
  const nodes: ReactNode[] = [];
  const pattern = /(!\[[^\]]*]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
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
    } else if (token.startsWith("![")) {
      const imageMatch = token.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imageMatch) {
        nodes.push(
          <img
            key={`image-${matchIndex}`}
            src={imageMatch[2]}
            alt={imageMatch[1] || "Embedded markdown image"}
            loading="lazy"
          />,
        );
      } else {
        nodes.push(token);
      }
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

function countLeadingSpaces(text: string) {
  return text.match(/^ */)?.[0].length ?? 0;
}

type ListType = "ul" | "ol";

function parseList(
  lines: string[],
  startIndex: number,
  options: RenderRecapMarkdownOptions,
  keyRef: { value: number },
  listType: ListType,
  baseIndent = countLeadingSpaces(lines[startIndex] || ""),
) {
  const items: ReactNode[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) break;

    const indent = countLeadingSpaces(raw);
    if (indent < baseIndent) break;
    if (indent > baseIndent) break;

    const markerPattern = listType === "ul" ? /^[-*+]\s+(.+)$/ : /^\d+\.\s+(.+)$/;
    const markerMatch = trimmed.match(markerPattern);
    if (!markerMatch) break;

    const textParts = [markerMatch[1]];
    const nestedNodes: ReactNode[] = [];
    i += 1;

    while (i < lines.length) {
      const nextRaw = lines[i];
      const nextTrimmed = nextRaw.trim();
      if (!nextTrimmed) break;
      const nextIndent = countLeadingSpaces(nextRaw);

      if (nextIndent <= baseIndent) break;

      const nestedType = nextTrimmed.match(/^[-*+]\s+/) ? "ul" : nextTrimmed.match(/^\d+\.\s+/) ? "ol" : null;
      if (nestedType) {
        const nestedList = parseList(lines, i, options, keyRef, nestedType, nextIndent);
        nestedNodes.push(nestedList.node);
        i = nestedList.nextIndex;
        continue;
      }

      textParts.push(nextTrimmed);
      i += 1;
    }

    items.push(
      <li key={`list-item-${keyRef.value++}`}>
        {renderInlineMarkdown(textParts.join(" "), options)}
        {nestedNodes.length ? nestedNodes : null}
      </li>,
    );

    while (i < lines.length && !lines[i].trim()) {
      i += 1;
      break;
    }
  }

  const listNode =
    listType === "ul" ? (
      <ul key={`ul-${keyRef.value++}`}>{items}</ul>
    ) : (
      <ol key={`ol-${keyRef.value++}`}>{items}</ol>
    );

  return { node: listNode, nextIndex: i };
}

function parseTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function renderRecapMarkdown(content: string, options: RenderRecapMarkdownOptions) {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let i = 0;
  const key = { value: 0 };

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
      blocks.push(<HeadingTag key={`h-${key.value++}`}>{renderInlineMarkdown(text, options)}</HeadingTag>);
      i += 1;
      continue;
    }

    if (/^(```|~~~)/.test(line)) {
      const fence = line.startsWith("~~~") ? "~~~" : "```";
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length && lines[i].trim().startsWith(fence)) {
        i += 1;
      }
      blocks.push(
        <pre key={`pre-${key.value++}`}>
          <code className={language ? `language-${language}` : undefined}>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      blocks.push(<hr key={`hr-${key.value++}`} />);
      i += 1;
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length) {
      const delimiter = lines[i + 1].trim();
      const tableDelimiterPattern = /^(\|?\s*:?-{3,}:?\s*)(\|\s*:?-{3,}:?\s*)+\|?$/;
      if (tableDelimiterPattern.test(delimiter)) {
        const headerCells = parseTableRow(line);
        const bodyRows: string[][] = [];
        i += 2;
        while (i < lines.length && lines[i].trim().includes("|")) {
          bodyRows.push(parseTableRow(lines[i]));
          i += 1;
        }
        blocks.push(
          <div className="markdown-table-wrap" key={`table-wrap-${key.value++}`}>
            <table>
              <thead>
                <tr>
                  {headerCells.map((cell, cellIndex) => (
                    <th key={`table-head-${key.value++}-${cellIndex}`}>{renderInlineMarkdown(cell, options)}</th>
                  ))}
                </tr>
              </thead>
              {bodyRows.length ? (
                <tbody>
                  {bodyRows.map((row, rowIndex) => (
                    <tr key={`table-row-${key.value++}-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`table-cell-${key.value++}-${rowIndex}-${cellIndex}`}>
                          {renderInlineMarkdown(cell, options)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ) : null}
            </table>
          </div>,
        );
        continue;
      }
    }

    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push(
        <blockquote key={`q-${key.value++}`}>{renderInlineMarkdown(quoteLines.join(" "), options)}</blockquote>,
      );
      continue;
    }

    if (line.match(/^[-*+]\s+/)) {
      const parsed = parseList(lines, i, options, key, "ul");
      blocks.push(parsed.node);
      i = parsed.nextIndex;
      continue;
    }

    if (line.match(/^\d+\.\s+/)) {
      const parsed = parseList(lines, i, options, key, "ol");
      blocks.push(parsed.node);
      i = parsed.nextIndex;
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length && lines[i].trim()) {
      paragraphLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push(<p key={`p-${key.value++}`}>{renderInlineMarkdown(paragraphLines.join(" "), options)}</p>);
  }

  return blocks.length ? blocks : [<p key="empty">{content}</p>];
}
