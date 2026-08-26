import { MarketOverviewBar } from "@/components/features/MarketOverviewBar";
import { SentimentDashboard } from "@/components/features/SentimentDashboard";
import { getNews } from "@/lib/data/get-news";
import { getSentiment } from "@/lib/data/get-sentiment";
export default async function SentimentPage(){const [data,news]=await Promise.all([getSentiment(),getNews()]);return <div><MarketOverviewBar/><div className="p-4 md:p-6"><h1 className="font-display text-display font-semibold tracking-tight">Market sentiment</h1><p className="mt-1 text-sm text-slate-500">A combined view of investor mood, news tone and institutional positioning.</p><SentimentDashboard data={data} news={news}/></div></div>}
