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
  if (!periods.length) return <section className="panel p-8 text-center"><h2 className="font-display text-title font-semibold">Financial statements are not synchronized yet</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">Run the free Vnstock fundamentals sync for this ticker to unlock quarterly horizontal analysis.</p></section>;
  const latest = periods.at(-1)!;
  const latestQuarter = quarterKey(latest.periodEnd);
  const previous = periods.find((period) => quarterKey(period.periodEnd) === latestQuarter - 1);
  const yearAgo = periods.find((period) => quarterKey(period.periodEnd) === latestQuarter - 4);
  const metrics = [
    { label: "Revenue", value: latest.revenue, qoq: growth(latest.revenue, previous?.revenue ?? null), yoy: growth(latest.revenue, yearAgo?.revenue ?? null) },
    { label: "Gross profit", value: latest.grossProfit, qoq: growth(latest.grossProfit, previous?.grossProfit ?? null), yoy: growth(latest.grossProfit, yearAgo?.grossProfit ?? null) },
    { label: "Net profit", value: latest.netProfit, qoq: growth(latest.netProfit, previous?.netProfit ?? null), yoy: growth(latest.netProfit, yearAgo?.netProfit ?? null) },
    { label: "EPS", value: latest.eps, qoq: growth(latest.eps, previous?.eps ?? null), yoy: growth(latest.eps, yearAgo?.eps ?? null) },
  ];
  return <section className="panel overflow-hidden"><div className="panel-header"><div><h2 className="font-display text-title font-semibold">Business performance</h2><p className="mt-1 text-xs text-slate-500">Horizontal analysis across {periods.length} reported quarters · Unit: {latest.unit}</p></div><span className="font-mono text-xs text-slate-500">Latest {latest.period}</span></div><div className="grid xl:grid-cols-[1.35fr_.65fr]"><div className="min-h-[360px] p-5 xl:border-r"><ResponsiveContainer width="100%" height={320}><BarChart data={periods} margin={{top:12,right:8,left:0,bottom:0}}><CartesianGrid stroke="#e2e8f0" vertical={false}/><XAxis dataKey="period" tick={{fontSize:11,fill:"#64748b"}}/><YAxis tickFormatter={(value) => compact(Number(value))} tick={{fontSize:11,fill:"#64748b"}} width={58}/><Tooltip formatter={(value) => compact(Number(value))} contentStyle={{border:"1px solid #e2e8f0",borderRadius:4,fontSize:12}}/><Legend wrapperStyle={{fontSize:12}}/><Bar dataKey="revenue" name="Revenue" fill="#0f172a" radius={[2,2,0,0]}/><Bar dataKey="grossProfit" name="Gross profit" fill="#64748b" radius={[2,2,0,0]}/><Bar dataKey="netProfit" name="Net profit" fill="#059669" radius={[2,2,0,0]}/></BarChart></ResponsiveContainer></div><div className="divide-y">{metrics.map((metric) => <div key={metric.label} className="p-5"><div className="flex items-baseline justify-between gap-3"><span className="text-sm font-semibold">{metric.label}</span><span className="font-mono text-lg font-semibold">{compact(metric.value)}</span></div><div className="mt-3 grid grid-cols-2 gap-3 text-xs"><span className="text-slate-500">QoQ <b className={metric.qoq == null ? "text-slate-500" : metric.qoq >= 0 ? "text-bull" : "text-bear"}>{metric.qoq == null ? "—" : `${metric.qoq >= 0 ? "+" : ""}${metric.qoq.toFixed(1)}%`}</b></span><span className="text-slate-500">YoY <b className={metric.yoy == null ? "text-slate-500" : metric.yoy >= 0 ? "text-bull" : "text-bear"}>{metric.yoy == null ? "—" : `${metric.yoy >= 0 ? "+" : ""}${metric.yoy.toFixed(1)}%`}</b></span></div></div>)}</div></div><div className="overflow-x-auto border-t"><table className="w-full min-w-[720px]"><thead className="bg-slate-50 text-left"><tr><th className="label px-5 py-3">Period</th><th className="label px-5 py-3 text-right">Revenue</th><th className="label px-5 py-3 text-right">Gross profit</th><th className="label px-5 py-3 text-right">Operating profit</th><th className="label px-5 py-3 text-right">Net profit</th><th className="label px-5 py-3 text-right">EPS</th></tr></thead><tbody>{[...periods].reverse().map((period) => <tr key={period.period} className="table-row"><td className="px-5 py-3 font-mono text-xs font-semibold">{period.period}</td>{[period.revenue,period.grossProfit,period.operatingProfit,period.netProfit,period.eps].map((value,index) => <td key={index} className="px-5 py-3 text-right font-mono text-xs">{compact(value)}</td>)}</tr>)}</tbody></table></div></section>;
}
