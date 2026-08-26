import type { NewsItem, PortfolioStrategy, RankingItem, SentimentData, StockAnalysis } from "@/types/stock";

export const marketIndices = [
  { name: "VN-INDEX", value: "1,284.32", change: 0.62 }, { name: "VN30", value: "1,337.18", change: 0.81 }, { name: "HNX", value: "238.41", change: -0.18 }, { name: "UPCOM", value: "94.06", change: 0.25 }
];
export const rankings: RankingItem[] = [
  { rank: 1, symbol: "FPT", company: "FPT Corporation", sector: "Technology", price: 134500, change: 2.36, score: 92, rating: "Strong Buy" },
  { rank: 2, symbol: "MWG", company: "Mobile World", sector: "Retail", price: 68200, change: 1.94, score: 88, rating: "Buy" },
  { rank: 3, symbol: "HPG", company: "Hoa Phat Group", sector: "Materials", price: 29400, change: 1.38, score: 84, rating: "Buy" },
  { rank: 4, symbol: "VCB", company: "Vietcombank", sector: "Financials", price: 91800, change: -0.43, score: 77, rating: "Neutral" },
  { rank: 5, symbol: "VNM", company: "Vinamilk", sector: "Consumer", price: 66700, change: -1.04, score: 69, rating: "Sell" }
];
export const analysis: StockAnalysis = { symbol: "FPT", company: "FPT Corporation", price: 134500, change: 2.36, score: 92, summary: "Growth remains supported by overseas IT services and the domestic digital-transformation backlog.", evidence: [
  { label: "Revenue growth", value: "+21.4%", detail: "Trailing twelve months", tone: "positive" }, { label: "ROE", value: "27.8%", detail: "Above sector median", tone: "positive" }, { label: "Forward P/E", value: "21.6×", detail: "Premium valuation", tone: "neutral" }
] };
export const news: NewsItem[] = [
  { id: "1", headline: "Technology exporters extend gains on stronger order outlook", source: "Market Brief", publishedAt: "08:40", sentiment: "positive", summary: "Large-cap technology names led morning liquidity." },
  { id: "2", headline: "Banks trade mixed as margin expectations normalize", source: "Vietnam Finance", publishedAt: "08:12", sentiment: "neutral", summary: "Investors balanced credit growth against funding costs." },
  { id: "3", headline: "Foreign investors remain net sellers in blue chips", source: "Exchange Watch", publishedAt: "Yesterday", sentiment: "negative", summary: "Outflows were concentrated in financial and property stocks." }
];
export const sentiment: SentimentData = { score: 68, label: "Greed", socialPositive: 54, socialNeutral: 31, socialNegative: 15, institutionalNet: 428, updatedAt: "10:15 ICT" };
export const strategies: PortfolioStrategy[] = [
  { id: "growth", name: "Growth Leaders", description: "High-quality companies compounding earnings above market.", risk: "High", returnYtd: 18.6, volatility: 15.2, allocation: [{ symbol: "FPT", company: "FPT Corp", weight: 30, change: 2.36 }, { symbol: "MWG", company: "Mobile World", weight: 25, change: 1.94 }, { symbol: "HPG", company: "Hoa Phat", weight: 25, change: 1.38 }, { symbol: "MBB", company: "MB Bank", weight: 20, change: 0.72 }] },
  { id: "dividend", name: "Dividend Income", description: "Durable cash flows and consistent shareholder distributions.", risk: "Medium", returnYtd: 11.2, volatility: 9.4, allocation: [{ symbol: "VNM", company: "Vinamilk", weight: 30, change: -1.04 }, { symbol: "GAS", company: "PV Gas", weight: 25, change: 0.45 }, { symbol: "REE", company: "REE Corp", weight: 25, change: 0.88 }, { symbol: "SAB", company: "Sabeco", weight: 20, change: -0.24 }] },
  { id: "value", name: "Value Select", description: "Mispriced leaders with improving fundamentals.", risk: "Medium", returnYtd: 14.8, volatility: 12.1, allocation: [{ symbol: "HPG", company: "Hoa Phat", weight: 30, change: 1.38 }, { symbol: "VCB", company: "Vietcombank", weight: 25, change: -0.43 }, { symbol: "VHM", company: "Vinhomes", weight: 25, change: 0.91 }, { symbol: "VNM", company: "Vinamilk", weight: 20, change: -1.04 }] },
  { id: "defensive", name: "Defensive Core", description: "Lower-beta portfolio for capital preservation.", risk: "Low", returnYtd: 8.4, volatility: 6.8, allocation: [{ symbol: "VNM", company: "Vinamilk", weight: 30, change: -1.04 }, { symbol: "DHG", company: "DHG Pharma", weight: 25, change: 0.22 }, { symbol: "REE", company: "REE Corp", weight: 25, change: 0.88 }, { symbol: "VCB", company: "Vietcombank", weight: 20, change: -0.43 }] }
];
export const chartData = [{ t: "09:00", value: 1272 }, { t: "10:00", value: 1278 }, { t: "11:00", value: 1275 }, { t: "13:00", value: 1281 }, { t: "14:00", value: 1279 }, { t: "15:00", value: 1284 }];
