export interface EvidenceItem { label: string; value: string; detail: string; tone?: "positive" | "negative" | "neutral"; }
export interface FinancialPeriod { period: string; periodEnd: ISODate; revenue: number | null; grossProfit: number | null; operatingProfit: number | null; profitBeforeTax: number | null; netProfit: number | null; eps: number | null; unit: string; }
export interface RelatedStock { symbol: string; company: string; exchange: string; price: number | null; change: number | null; }
export interface ResearchCitation { title: string; url: string; source?: string; }
export interface TrendForecast { horizon: "1M" | "3M" | "6M"; direction: MarketBias; bullishProbability: number; neutralProbability: number; bearishProbability: number; rationale: string; }
export interface GroundedResearch { summary: string; outlook: string; catalysts: string[]; risks: string[]; forecasts: TrendForecast[]; citations: ResearchCitation[]; asOf: string; cached: boolean; model: string; }
export interface StockAnalysis { symbol: string; company: string; sector: string; exchange: string; price: number | null; change: number | null; score: number; summary: string; evidence: EvidenceItem[]; financials: FinancialPeriod[]; related: RelatedStock[]; updatedAt: string | null; }
export interface RankingItem { rank: number; symbol: string; company: string; sector: string; price: number; change: number; score: number; rating: "Strong Buy" | "Buy" | "Neutral" | "Sell"; rsi14?: number; relativeVolume?: number; trend?: "Bullish" | "Bearish" | "Flat"; }
export interface PortfolioStrategy { id: string; name: string; description: string; risk: string; returnYtd: number; volatility: number; allocation: { symbol: string; company: string; weight: number; change: number }[]; }
export interface NewsItem { id: string; headline: string; source: string; publishedAt: string; sentiment: "positive" | "negative" | "neutral"; summary: string; }
export interface SentimentData { score: number; label: string; socialPositive: number; socialNeutral: number; socialNegative: number; institutionalNet: number; updatedAt: string; }

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

export type PortfolioStrategyType = "growth" | "dividend" | "value" | "defensive";

export interface UserPortfolioSelectionRow {
  id: number;
  user_id: string;
  strategy_type: PortfolioStrategyType;
  selected_at: ISOTimestamp;
}
