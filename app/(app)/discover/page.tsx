import { MarketDashboard } from "@/components/features/MarketDashboard";
import { DiscoverClient } from "@/components/features/DiscoverClient";
import { getRankings } from "@/lib/data/get-rankings";

export default async function DiscoverPage() {
  const rankings = await getRankings();
  return <><MarketDashboard/><section className="border-t border-slate-200 p-4 md:p-6"><div className="mb-5"><h2 className="font-display text-title font-semibold">Discover by sector</h2><p className="mt-1 text-sm text-slate-500">Filter the current synthetic ranking universe by industry.</p></div><DiscoverClient items={rankings}/></section></>;
}
