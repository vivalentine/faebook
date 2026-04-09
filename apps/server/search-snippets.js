const MAX_SOURCE_LENGTH = 8000;
const TARGET_SNIPPET_LENGTH = 180;
const MIN_CONTEXT_LENGTH = 60;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getQueryTerms(query) {
  return Array.from(
    new Set(
      String(query || "")
        .toLowerCase()
        .split(/\s+/)
        .map((term) => term.trim())
        .filter((term) => term.length >= 2)
    )
  );
}

function normalizeSnippetSource(sourceText) {
  return String(sourceText || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SOURCE_LENGTH);
}

function findBestMatchOffset(sourceLower, terms) {
  if (!sourceLower || terms.length === 0) {
    return -1;
  }

  let bestIndex = -1;
  let bestLength = Number.POSITIVE_INFINITY;

  for (const term of terms) {
    const index = sourceLower.indexOf(term);
    if (index === -1) continue;

    if (index < bestIndex || bestIndex === -1) {
      bestIndex = index;
      bestLength = term.length;
    } else if (index === bestIndex && term.length < bestLength) {
      bestLength = term.length;
    }
  }

  return bestIndex;
}

function trimSnippetWindow(sourceText, terms) {
  if (!sourceText) {
    return {
      excerpt: "",
      truncated: false,
    };
  }

  const sourceLower = sourceText.toLowerCase();
  const matchOffset = findBestMatchOffset(sourceLower, terms);

  if (sourceText.length <= TARGET_SNIPPET_LENGTH) {
    return {
      excerpt: sourceText,
      truncated: false,
    };
  }

  if (matchOffset === -1) {
    const excerpt = sourceText.slice(0, TARGET_SNIPPET_LENGTH).trimEnd();
    return {
      excerpt: `${excerpt}…`,
      truncated: true,
    };
  }

  const before = Math.max(MIN_CONTEXT_LENGTH, Math.floor((TARGET_SNIPPET_LENGTH - 10) / 2));
  const start = Math.max(0, matchOffset - before);
  const end = Math.min(sourceText.length, start + TARGET_SNIPPET_LENGTH);

  const windowText = sourceText.slice(start, end).trim();
  const prefix = start > 0 ? "…" : "";
  const suffix = end < sourceText.length ? "…" : "";

  return {
    excerpt: `${prefix}${windowText}${suffix}`,
    truncated: start > 0 || end < sourceText.length,
  };
}

function highlightSnippet(excerpt, terms) {
  if (!excerpt) return "";

  const escapedExcerpt = escapeHtml(excerpt);
  if (terms.length === 0) {
    return escapedExcerpt;
  }

  const pattern = new RegExp(`(${terms.map((term) => escapeRegExp(term)).join("|")})`, "gi");
  return escapedExcerpt.replace(pattern, "<mark>$1</mark>");
}

function buildSnippetPayload({ query, sourceText }) {
  const terms = getQueryTerms(query);
  const source = normalizeSnippetSource(sourceText);
  const { excerpt, truncated } = trimSnippetWindow(source, terms);

  return {
    source,
    excerpt,
    highlighted_excerpt: highlightSnippet(excerpt, terms),
    truncated,
    matched_terms: terms.filter((term) => source.toLowerCase().includes(term)),
  };
}

module.exports = {
  buildSnippetPayload,
  getQueryTerms,
};
