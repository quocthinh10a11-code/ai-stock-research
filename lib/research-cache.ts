import { createHash } from "node:crypto";
import type { WebResearchSource } from "@/lib/tavily-search";

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)]),
    );
  }
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return value;
}

export function stableSerialize(value: unknown) {
  return JSON.stringify(normalize(value));
}

export function hashResearchInput(value: unknown) {
  return createHash("sha256").update(stableSerialize(value)).digest("hex");
}

export function hashWebSources(sources: WebResearchSource[]) {
  return hashResearchInput(sources.map((source) => ({
    title: source.title,
    url: source.url,
    content: source.content,
    publishedAt: source.publishedAt,
    source: source.source,
    documentType: source.documentType,
  })));
}

export function isFreshIso(expiresAt: unknown, now = Date.now()) {
  const timestamp = Date.parse(String(expiresAt ?? ""));
  return Number.isFinite(timestamp) && timestamp > now;
}

export function parseWebSources(value: unknown): WebResearchSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Record<string, unknown>;
    const url = String(source.url ?? "");
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return [];
    } catch {
      return [];
    }
    return [{
      title: String(source.title ?? "").slice(0, 300),
      url,
      content: String(source.content ?? "").slice(0, 16_000),
      publishedAt: source.publishedAt == null ? null : String(source.publishedAt),
      source: String(source.source ?? "").slice(0, 200),
      documentType: source.documentType === "pdf" ? "pdf" : "html",
      retrievedAt: source.retrievedAt == null ? undefined : String(source.retrievedAt),
    }];
  });
}
