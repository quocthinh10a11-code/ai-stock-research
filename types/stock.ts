export interface EvidenceItem { label: string; value: string; detail: string; tone?: "positive" | "negative" | "neutral"; }
export interface StockAnalysis { symbol: string; company: string; price: number; change: number; score: number; summary: string; evidence: EvidenceItem[]; }
export interface RankingItem { rank: number; symbol: string; company: string; sector: string; price: number; change: number; score: number; rating: "Strong Buy" | "Buy" | "Neutral" | "Sell"; }
export interface PortfolioStrategy { id: string; name: string; description: string; risk: string; returnYtd: number; volatility: number; allocation: { symbol: string; company: string; weight: number; change: number }[]; }
export interface NewsItem { id: string; headline: string; source: string; publishedAt: string; sentiment: "positive" | "negative" | "neutral"; summary: string; }
export interface SentimentData { score: number; label: string; socialPositive: number; socialNeutral: number; socialNegative: number; institutionalNet: number; updatedAt: string; }
