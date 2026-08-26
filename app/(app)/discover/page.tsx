import { MarketOverviewBar } from "@/components/features/MarketOverviewBar";
import { DiscoverClient } from "@/components/features/DiscoverClient";
import { getRankings } from "@/lib/data/get-rankings";
export default async function DiscoverPage(){const items=await getRankings();return <div><MarketOverviewBar/><div className="p-4 md:p-6"><h1 className="font-display text-display font-semibold tracking-tight">Discover market leaders</h1><p className="mb-6 mt-1 text-sm text-slate-500">Compare sector-relative quality, momentum and sentiment signals.</p><DiscoverClient items={items}/></div></div>}
