export interface EvidenceItem { label: string; value: string; detail: string; tone?: "positive" | "negative" | "neutral"; }
export interface FinancialPeriod { period: string; periodEnd: ISODate; revenue: number | null; grossProfit: number | null; operatingProfit: number | null; profitBeforeTax: number | null; netProfit: number | null; eps: number | null; totalAssets: number | null; totalLiabilities: number | null; equity: number | null; operatingCashFlow: number | null; unit: string; }
export interface RelatedStock { symbol: string; company: string; exchange: string; price: number | null; change: number | null; }
export interface ResearchCitation { title: string; url: string; source?: string; publishedAt?: string | null; insight?: string; sentiment?: "positive" | "negative" | "neutral"; }
export interface TrendForecast { horizon: "1M" | "3M" | "6M"; direction: MarketBias; bullishProbability: number; neutralProbability: number; bearishProbability: number; rationale: string; }
export type InvestmentAction = "buy" | "accumulate" | "hold" | "reduce" | "sell" | "insufficient_data";
export interface InvestmentMetric { name: string; value: string | null; trend: string | null; sourceIndices: number[]; }
export interface InvestmentDecisionRow { group: "business_performance" | "valuation" | "financial_health" | "risk_momentum"; title: string; metrics: InvestmentMetric[]; analysis: string; action: InvestmentAction; confidence: "low" | "medium" | "high"; rationale: string; }
export interface GroundedResearch { summary: string; outlook: string; catalysts: string[]; risks: string[]; forecasts: TrendForecast[]; decisionMatrix: InvestmentDecisionRow[]; citations: ResearchCitation[]; asOf: string; expiresAt: string; cached: boolean; model: string; }
export type FreshnessKind = "market" | "technical" | "fundamentals" | "disclosures" | "sector" | "ai";
export type FreshnessStatus = "Live" | "Delayed" | "EOD" | "Cached" | "Stale";
export type MarketSession = "open" | "closed";
export interface FreshnessInfo { providerTimestamp: string | null; fetchedAt: string | null; expiresAt: string | null; sourceName: string; sourceUrl: string | null; dataQuality: string | null; lastError: string | null; refreshStatus: string | null; status: FreshnessStatus; marketSession: MarketSession; }
export interface CurrentMarketSnapshot {
  symbol: string;
  price_date: string | null;
  close: number | string | null;
  previous_close: number | string | null;
  price_provider_timestamp: string | null;
  price_fetched_at: string | null;
  price_expires_at: string | null;
  price_source_name: string;
  price_source_url: string | null;
  price_data_quality: string | null;
  price_last_error: string | null;
  price_refresh_status: string | null;
}
export interface OfficialDisclosure { title: string; excerpt: string | null; publishedAt: string; sourceName: string; sourceUrl: string; }
export interface StockAnalysis { symbol: string; company: string; sector: string; exchange: string; price: number | null; change: number | null; score: number; summary: string; evidence: EvidenceItem[]; financials: FinancialPeriod[]; disclosures: OfficialDisclosure[]; related: RelatedStock[]; updatedAt: string | null; currentMarketSnapshot: CurrentMarketSnapshot; marketFreshness: FreshnessInfo; technicalFreshness: FreshnessInfo; fundamentalsFreshness: FreshnessInfo; disclosureFreshness: FreshnessInfo; }
export interface ScreenerCriterion { key: string; label: string; value: string | number | null; target: string; passed: boolean | null; }
export interface ScreenerExclusionSummary { sector: string | null; reasonCode: string; reason: string; count: number; sampleSymbols: string[]; observedAt: string; }
export interface RankingItem { rank: number; symbol: string; company: string; sector: string; industry?: string; exchange?: "HOSE" | "HNX" | "UPCOM"; price: number; change: number; score: number; rating: "Strong Buy" | "Buy" | "Neutral" | "Sell"; marketCap?: number; averageVolume20?: number; pe?: number; roe?: number; revenueGrowth?: number; profitGrowth?: number; debtToEquity?: number; passedCriteria?: number; availableCriteria?: number; eligible?: boolean; screenedAt?: string; freshness?: FreshnessInfo; criteria?: ScreenerCriterion[]; rsi14?: number; relativeVolume?: number; trend?: "Bullish" | "Bearish" | "Flat"; }
export interface SectorAiBrief { sector: string; symbols: string[]; summary: string; highlights: string[]; citations: ResearchCitation[]; asOf: string; expiresAt: string; cached: boolean; model: string; }

export type ISODate = string;
export type ISOTimestamp = string;
export type MarketBias = "bullish" | "neutral" | "bearish";
export type SignalDirection = "supporting" | "contradicting";
export type PredictionOutcome = "pending" | "correct" | "incorrect" | "inconclusive";

export interface StockRow {
  symbol: string;
  company_name: string;
  sector: string;
  exchange: "HOSE" | "HNX" | "UPCOM";
  updated_at: ISOTimestamp;
  icb_level2_code?: string | null;
  icb_level2_name?: string | null;
  sector_group?: string | null;
}

export interface PriceHistoryRow {
  id: number;
  symbol: string;
  date: ISODate;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface EvidenceSnapshotRow {
  id: number;
  symbol: string;
  date: ISODate;
  signal_name: string;
  signal_value: number;
  signal_direction: SignalDirection;
  source: string;
  created_at: ISOTimestamp;
}

export interface AgentAnalysisRow {
  id: number;
  symbol: string;
  analysis_date: ISODate;
  bias: MarketBias;
  bias_label: string;
  summary_text: string;
  key_levels_json: Record<string, number | string | null>;
  watch_for_text: string;
  created_at: ISOTimestamp;
}

export interface PredictionLogRow {
  id: number;
  symbol: string;
  prediction_date: ISODate;
  evidence_snapshot_id: number;
  bias_at_prediction: MarketBias;
  scenario_text: string;
  target_check_date: ISODate;
  actual_return_pct: number | null;
  outcome_status: PredictionOutcome;
  created_at: ISOTimestamp;
}

export interface UserWatchlistRow {
  id: number;
  user_id: string;
  symbol: string;
  added_at: ISOTimestamp;
  notes: string | null;
}

export interface ResearchHistoryRow {
  id: number;
  user_id: string;
  symbol: string;
  viewed_at: ISOTimestamp;
}
