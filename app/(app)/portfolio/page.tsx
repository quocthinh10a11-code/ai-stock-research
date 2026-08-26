import { DisclaimerCard } from "@/components/features/DisclaimerCard";
import { MarketOverviewBar } from "@/components/features/MarketOverviewBar";
import { PortfolioDashboard } from "@/components/features/PortfolioDashboard";
import { getPortfolios } from "@/lib/data/get-portfolios";
import { getUserPortfolioSelection, getUserWatchlist } from "@/lib/data/get-user-research";
export default async function PortfolioPage(){const strategies=await getPortfolios();const selectedStrategy=await getUserPortfolioSelection();const watchlist=await getUserWatchlist();return <div><MarketOverviewBar/><div className="p-4 md:p-6"><h1 className="font-display text-display font-semibold tracking-tight">Model portfolios</h1><p className="mb-6 mt-1 text-sm text-slate-500">Compare transparent strategy allocations built from synthetic research signals.</p><PortfolioDashboard strategies={strategies} initialSelection={selectedStrategy} initialWatchlist={watchlist}/><div className="mt-5"><DisclaimerCard/></div></div></div>}
