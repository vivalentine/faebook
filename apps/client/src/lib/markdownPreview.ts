const HORIZONTAL_RULE_PATTERN = /^\s{0,3}(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/gm;

function truncateAtWord(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  const sliced = text.slice(0, maxLength + 1).trimEnd();
  const lastSpace = sliced.lastIndexOf(" ");
  if (lastSpace > Math.floor(maxLength * 0.6)) {
    return `${sliced.slice(0, lastSpace).trimEnd()}…`;
  }
  return `${sliced.slice(0, maxLength).trimEnd()}…`;
}

export function formatMarkdownPreview(markdown: string, maxLength = 180) {
  const cleaned = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`{1,2}([^`]+)`{1,2}/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[\[([^\]]+)\]\]/g, " ")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(HORIZONTAL_RULE_PATTERN, " ")
    .replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gm, "")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\\([`*_{}\[\]()#+\-.!>])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "";
  }

  return truncateAtWord(cleaned, maxLength);
}
