import { DisclaimerCard } from "@/components/features/DisclaimerCard";
import { MarketOverviewBar } from "@/components/features/MarketOverviewBar";
import { PortfolioDashboard } from "@/components/features/PortfolioDashboard";
import { getPortfolios } from "@/lib/data/get-portfolios";
export default async function PortfolioPage(){const strategies=await getPortfolios();return <div><MarketOverviewBar/><div className="p-4 md:p-6"><h1 className="font-display text-display font-semibold tracking-tight">Model portfolios</h1><p className="mb-6 mt-1 text-sm text-slate-500">Compare transparent strategy allocations built from synthetic research signals.</p><PortfolioDashboard strategies={strategies}/><div className="mt-5"><DisclaimerCard/></div></div></div>}
