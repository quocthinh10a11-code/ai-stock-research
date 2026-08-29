export const refreshDataTypes = ["market", "fundamentals", "disclosures"] as const;
export type RefreshDataType = typeof refreshDataTypes[number];

const supportedTypes = new Set<string>(refreshDataTypes);

export function normalizeRefreshDataTypes(value: unknown): RefreshDataType[] {
  const items = value == null ? ["market", "fundamentals"] : value;
  if (!Array.isArray(items) || items.length < 1 || items.length > refreshDataTypes.length) {
    throw new Error("dataTypes must contain between 1 and 3 values");
  }
  const normalized = [...new Set(items.map((item) => String(item).trim().toLowerCase()))];
  if (normalized.some((item) => !supportedTypes.has(item))) throw new Error("unsupported refresh data type");
  return normalized as RefreshDataType[];
}

function isStale(expiresAt: string | null | undefined, now: Date) {
  if (!expiresAt) return true;
  const timestamp = new Date(expiresAt).getTime();
  return !Number.isFinite(timestamp) || timestamp <= now.getTime();
}

export function staleStructuredDataTypes(
  input: { marketExpiresAt?: string | null; fundamentalsExpiresAt?: string | null },
  now = new Date(),
): RefreshDataType[] {
  const result: RefreshDataType[] = [];
  if (isStale(input.marketExpiresAt, now)) result.push("market");
  if (isStale(input.fundamentalsExpiresAt, now)) result.push("fundamentals");
  return result;
}
