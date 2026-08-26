import Link from "next/link";
import { BarChart3 } from "lucide-react";
export function Logo({ inverse = false }: { inverse?: boolean }) { return <Link href="/home" className="flex items-center gap-2.5 rounded-sm"><span className={`grid size-8 place-items-center rounded ${inverse ? "bg-white text-navy" : "bg-navy text-white"}`}><BarChart3 size={18} /></span><span className={`font-display text-sm font-bold tracking-tight ${inverse ? "text-white" : "text-navy"}`}>AI STOCK RESEARCH</span></Link>; }
