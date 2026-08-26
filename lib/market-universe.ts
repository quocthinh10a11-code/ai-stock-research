export const marketUniverse = ["VCB", "SSI", "HPG", "FPT", "VHM", "VIC", "VND", "MWG", "DGC", "VPB", "VNM", "MBB"] as const;

const symbols = new Set<string>(marketUniverse);

export function normalizeStockSymbol(value: string) {
  return value.trim().toUpperCase();
}

export function isSupportedStockSymbol(value: string) {
  return symbols.has(normalizeStockSymbol(value));
}
