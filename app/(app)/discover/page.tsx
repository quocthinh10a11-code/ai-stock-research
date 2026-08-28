import { DiscoverClient } from "@/components/features/DiscoverClient";
import { getRankings } from "@/lib/data/get-rankings";
import { getUserWatchlist } from "@/lib/data/get-user-research";

export default async function DiscoverPage() {
  const rankings = await getRankings();
  const watchlist = await getUserWatchlist();
  return (
    <section className="mx-auto max-w-7xl px-5 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-navy">Khám phá cổ phiếu</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Top 5 cổ phiếu theo từng ngành, xếp hạng từ tín hiệu EMA và dữ liệu OHLCV đã đồng bộ.
        </p>
      </div>
      <DiscoverClient items={rankings} initialWatchlist={watchlist} />
    </section>
  );
}
