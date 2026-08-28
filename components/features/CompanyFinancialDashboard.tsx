"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FinancialPeriod } from "@/types/stock";

function compact(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function growth(current: number | null, previous: number | null) {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function quarterKey(periodEnd: string) {
  const value = new Date(`${periodEnd}T00:00:00Z`);
  return value.getUTCFullYear() * 4 + Math.floor(value.getUTCMonth() / 3);
}

export function CompanyFinancialDashboard({ periods }: { periods: FinancialPeriod[] }) {
  if (!periods.length) return <section className="panel p-7"><h2 className="text-lg font-bold text-navy">Chưa có báo cáo tài chính đã đồng bộ</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">AI vẫn tìm báo cáo và chỉ số trên internet ở phần trên. Các giá trị không có nguồn xác thực sẽ được đánh dấu “Chưa có”.</p></section>;
  const latest = periods.at(-1)!;
  const latestQuarter = quarterKey(latest.periodEnd);
  const previous = periods.find((period) => quarterKey(period.periodEnd) === latestQuarter - 1);
  const yearAgo = periods.find((period) => quarterKey(period.periodEnd) === latestQuarter - 4);
  const chartPeriods = periods.slice(-8);
  const metrics = [
    { label: "Doanh thu", value: latest.revenue, qoq: growth(latest.revenue, previous?.revenue ?? null), yoy: growth(latest.revenue, yearAgo?.revenue ?? null) },
    { label: "Lợi nhuận gộp", value: latest.grossProfit, qoq: growth(latest.grossProfit, previous?.grossProfit ?? null), yoy: growth(latest.grossProfit, yearAgo?.grossProfit ?? null) },
    { label: "Lợi nhuận sau thuế", value: latest.netProfit, qoq: growth(latest.netProfit, previous?.netProfit ?? null), yoy: growth(latest.netProfit, yearAgo?.netProfit ?? null) },
    { label: "EPS", value: latest.eps, qoq: growth(latest.eps, previous?.eps ?? null), yoy: growth(latest.eps, yearAgo?.eps ?? null) },
  ];

  return <section className="panel overflow-hidden"><div className="panel-header"><div><h2 className="text-lg font-bold text-navy">Kết quả kinh doanh theo chiều ngang</h2><p className="mt-1 text-xs text-slate-500">{periods.length} quý đã đồng bộ · Đơn vị nguồn: {latest.unit}</p></div><span className="font-mono text-xs font-semibold text-slate-500">Mới nhất {latest.period}</span></div><div className="grid xl:grid-cols-[1.35fr_.65fr]"><div className="min-h-[340px] p-4 md:p-5 xl:border-r"><ResponsiveContainer width="100%" height={310}><BarChart data={chartPeriods} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}><CartesianGrid stroke="#e2e8f0" vertical={false}/><XAxis dataKey="period" tick={{ fontSize: 11, fill: "#64748b" }}/><YAxis tickFormatter={(value) => compact(Number(value))} tick={{ fontSize: 11, fill: "#64748b" }} width={58}/><Tooltip formatter={(value) => compact(Number(value))} contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}/><Legend wrapperStyle={{ fontSize: 12 }}/><Bar dataKey="revenue" name="Doanh thu" fill="#0f172a" radius={[3, 3, 0, 0]}/><Bar dataKey="grossProfit" name="LN gộp" fill="#64748b" radius={[3, 3, 0, 0]}/><Bar dataKey="netProfit" name="LN sau thuế" fill="#16a34a" radius={[3, 3, 0, 0]}/></BarChart></ResponsiveContainer></div><div className="divide-y divide-slate-200">{metrics.map((metric) => <div key={metric.label} className="p-5"><div className="flex items-baseline justify-between gap-3"><span className="text-sm font-semibold text-slate-700">{metric.label}</span><span className="font-mono text-lg font-bold text-navy">{compact(metric.value)}</span></div><div className="mt-3 grid grid-cols-2 gap-3 text-xs"><span className="text-slate-500">QoQ <b className={metric.qoq == null ? "text-slate-500" : metric.qoq >= 0 ? "text-bull" : "text-bear"}>{metric.qoq == null ? "—" : `${metric.qoq >= 0 ? "+" : ""}${metric.qoq.toFixed(1)}%`}</b></span><span className="text-slate-500">YoY <b className={metric.yoy == null ? "text-slate-500" : metric.yoy >= 0 ? "text-bull" : "text-bear"}>{metric.yoy == null ? "—" : `${metric.yoy >= 0 ? "+" : ""}${metric.yoy.toFixed(1)}%`}</b></span></div></div>)}</div></div><div className="overflow-x-auto border-t border-slate-200"><table className="w-full min-w-[860px]"><thead className="bg-slate-50 text-left"><tr>{["Kỳ", "Doanh thu", "LN gộp", "LN hoạt động", "LN sau thuế", "EPS", "Dòng tiền HĐKD"].map((heading) => <th key={heading} className="label px-5 py-3 text-right first:text-left">{heading}</th>)}</tr></thead><tbody>{[...periods].reverse().map((period) => <tr key={period.period} className="table-row"><td className="px-5 py-3 font-mono text-xs font-bold">{period.period}</td>{[period.revenue, period.grossProfit, period.operatingProfit, period.netProfit, period.eps, period.operatingCashFlow].map((value, index) => <td key={index} className="px-5 py-3 text-right font-mono text-xs">{compact(value)}</td>)}</tr>)}</tbody></table></div></section>;
}
