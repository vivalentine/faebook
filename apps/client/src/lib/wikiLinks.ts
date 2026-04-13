import { useEffect, useMemo, useState } from "react";
import type { Npc } from "../types";
import { apiFetch } from "./api";

type WikiTextToken =
  | { type: "text"; value: string }
  | { type: "wiki-link"; target: string; label: string };

export type WikiNpcIndex = {
  bySlug: Map<string, Npc>;
  byName: Map<string, Npc>;
};

function normalizeWikiKey(value: string) {
  return value.trim().toLowerCase();
}

function parseWikiToken(tokenBody: string) {
  const [rawTarget, ...labelParts] = tokenBody.split("|");
  const target = rawTarget.trim();
  const customLabel = labelParts.join("|").trim();

  return {
    target,
    label: customLabel || target,
  };
}

export function parseWikiText(text: string): WikiTextToken[] {
  const pattern = /\[\[([^\]]+)\]\]/g;
  const tokens: WikiTextToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = pattern.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }

    const parsed = parseWikiToken(match[1]);
    if (parsed.target) {
      tokens.push({ type: "wiki-link", target: parsed.target, label: parsed.label });
    } else {
      tokens.push({ type: "text", value: match[0] });
    }

    lastIndex = match.index + match[0].length;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }

  return tokens;
}

export function buildWikiNpcIndex(npcs: Npc[]): WikiNpcIndex {
  const bySlug = new Map<string, Npc>();
  const byName = new Map<string, Npc>();

  for (const npc of npcs) {
    bySlug.set(normalizeWikiKey(npc.slug), npc);
    byName.set(normalizeWikiKey(npc.name), npc);
  }

  return { bySlug, byName };
}

export function resolveWikiNpc(target: string, index: WikiNpcIndex) {
  const normalized = normalizeWikiKey(target);
  const fromSlug = index.bySlug.get(normalized);
  if (fromSlug) return fromSlug;

  const fromName = index.byName.get(normalized);
  if (fromName) return fromName;

  const maybeSlug = normalized.replace(/^\/?directory\//, "");
  return index.bySlug.get(maybeSlug) || null;
}

export function useWikiNpcIndex() {
  const [npcs, setNpcs] = useState<Npc[]>([]);

  useEffect(() => {
    let active = true;

    async function loadNpcs() {
      try {
        const response = await apiFetch("/api/npcs");
        if (!response.ok) return;
        const data = (await response.json()) as Npc[];
        if (active) {
          setNpcs(Array.isArray(data) ? data : []);
        }
      } catch {
        if (active) {
          setNpcs([]);
        }
      }
    }

    void loadNpcs();

    return () => {
      active = false;
    };
  }, []);

  return useMemo(() => buildWikiNpcIndex(npcs), [npcs]);
}
