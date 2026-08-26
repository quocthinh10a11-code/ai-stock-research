"use client";

import { useEffect } from "react";
import { recordResearchView } from "@/app/actions/research-history";

export function ResearchHistoryTracker({ symbol }: { symbol: string }) {
  useEffect(() => { void recordResearchView(symbol); }, [symbol]);
  return null;
}
