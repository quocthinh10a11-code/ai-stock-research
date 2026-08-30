import { resolve4, resolve6 } from "node:dns/promises";
import { isIP } from "node:net";

const maxPdfBytes = 8 * 1024 * 1024;

export function isPublicIp(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  if (isIP(normalized) === 4) {
    const [a, b, c] = normalized.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 0 && (c === 0 || c === 2))
      || (a === 192 && b === 168)
      || (a === 192 && b === 88 && c === 99)
      || (a === 198 && (b === 18 || b === 19))
      || (a === 198 && b === 51 && c === 100)
      || (a === 203 && b === 0 && c === 113));
  }
  if (isIP(normalized) === 6) {
    if (normalized === "::" || normalized === "::1") return false;
    if (normalized.startsWith("fc") || normalized.startsWith("fd") || /^fe[89ab]/.test(normalized)) return false;
    if (normalized.startsWith("ff") || normalized.startsWith("::ffff:") || normalized.startsWith("64:ff9b:") || normalized.startsWith("2001:db8:") || normalized.startsWith("2002:")) return false;
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    return mapped ? isPublicIp(mapped) : true;
  }
  return false;
}

async function assertPublicHttpsUrl(value: string, lookup?: (hostname: string) => Promise<string[]>) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("Document URL must be public HTTPS");
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) throw new Error("Private hostname blocked");
  const addresses = lookup
    ? await lookup(hostname)
    : isIP(hostname)
      ? [hostname]
      : [...await resolve4(hostname).catch(() => []), ...await resolve6(hostname).catch(() => [])];
  if (!addresses.length || addresses.some((address) => !isPublicIp(address))) throw new Error("Private or unresolved address blocked");
  return url;
}

export async function fetchPublicPdf({
  url,
  fetchImpl = fetch,
  lookup,
  redirects = 0,
}: {
  url: string;
  fetchImpl?: typeof fetch;
  lookup?: (hostname: string) => Promise<string[]>;
  redirects?: number;
}): Promise<{ bytes: Uint8Array; finalUrl: string }> {
  const safeUrl = await assertPublicHttpsUrl(url, lookup);
  const response = await fetchImpl(safeUrl, {
    redirect: "manual",
    headers: { Accept: "application/pdf", "User-Agent": "AI-Stock-Research/1.0" },
    signal: AbortSignal.timeout(25_000),
  });
  if (response.status >= 300 && response.status < 400) {
    if (redirects >= 2) throw new Error("Too many PDF redirects");
    const location = response.headers.get("location");
    if (!location) throw new Error("PDF redirect has no location");
    return fetchPublicPdf({ url: new URL(location, safeUrl).toString(), fetchImpl, lookup, redirects: redirects + 1 });
  }
  if (!response.ok) throw new Error(`PDF source returned ${response.status}`);
  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > maxPdfBytes) throw new Error("PDF exceeds 8 MB limit");
  if (!response.body) throw new Error("PDF response has no body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxPdfBytes) {
      await reader.cancel();
      throw new Error("PDF exceeds 8 MB limit");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") throw new Error("Source is not a PDF");
  return { bytes, finalUrl: safeUrl.toString() };
}
