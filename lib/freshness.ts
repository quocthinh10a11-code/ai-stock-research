import type { FreshnessInfo, FreshnessKind, FreshnessStatus, MarketSession } from "@/types/stock";

type FreshnessInput = Omit<FreshnessInfo, "status" | "marketSession"> & {
  kind: FreshnessKind;
  now?: Date;
};

const statusByKind: Record<FreshnessKind, FreshnessStatus> = {
  market: "EOD",
  technical: "EOD",
  fundamentals: "Cached",
  sector: "Delayed",
  ai: "Cached",
};

export function getVietnamMarketSession(now = new Date()): MarketSession {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (value.weekday === "Sat" || value.weekday === "Sun") return "closed";
  const minutes = Number(value.hour) * 60 + Number(value.minute);
  return (minutes >= 9 * 60 && minutes < 11 * 60 + 30)
    || (minutes >= 13 * 60 && minutes < 15 * 60)
    ? "open"
    : "closed";
}

export function buildFreshness(input: FreshnessInput): FreshnessInfo {
  const now = input.now ?? new Date();
  const expired = input.expiresAt != null && new Date(input.expiresAt).getTime() <= now.getTime();
  const missingFetchTime = input.fetchedAt == null;
  const failed = input.refreshStatus === "error" || Boolean(input.lastError);
  return {
    providerTimestamp: input.providerTimestamp,
    fetchedAt: input.fetchedAt,
    expiresAt: input.expiresAt,
    sourceName: input.sourceName,
    sourceUrl: input.sourceUrl,
    dataQuality: input.dataQuality,
    lastError: input.lastError,
    refreshStatus: input.refreshStatus,
    status: expired || failed || missingFetchTime ? "Stale" : statusByKind[input.kind],
    marketSession: getVietnamMarketSession(now),
  };
}
