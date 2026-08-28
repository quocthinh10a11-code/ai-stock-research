import Link from "next/link";
import { BarChart3 } from "lucide-react";
export function Logo({ inverse = false }: { inverse?: boolean }) { return <Link href="/home" className="flex shrink-0 items-center gap-2.5 rounded-lg" aria-label="AI Stock Research — Trang chủ"><span className={`grid size-9 place-items-center rounded-lg ${inverse ? "bg-white text-navy" : "bg-navy text-white"}`}><BarChart3 size={18}/></span><span className={`hidden text-sm font-bold tracking-tight lg:inline ${inverse ? "text-white" : "text-navy"}`}>AI STOCK RESEARCH</span></Link>; }
