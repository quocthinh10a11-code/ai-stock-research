import { DiscoverClient } from "@/components/features/DiscoverClient";
import { getRankings, getScreeningExclusions } from "@/lib/data/get-rankings";
import { getUserWatchlist } from "@/lib/data/get-user-research";

export default async function DiscoverPage() {
  const [rankings, exclusions, watchlist] = await Promise.all([getRankings(), getScreeningExclusions(), getUserWatchlist()]);
  return (
    <section className="mx-auto max-w-7xl px-5 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-navy">Khám phá cổ phiếu</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Top 5 đáng quan tâm trong 10 nhóm ngành, dựa trên thanh khoản, tăng trưởng, hiệu quả, định giá và tiêu chí riêng từng ngành.
        </p>
      </div>
      <DiscoverClient items={rankings} exclusions={exclusions} initialWatchlist={watchlist} />
    </section>
  );
}
