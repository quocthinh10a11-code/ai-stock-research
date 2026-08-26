"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
export function HeroSearch() { const [symbol,setSymbol]=useState(""); const router=useRouter(); function submit(e:React.FormEvent){e.preventDefault();const clean=symbol.trim().toUpperCase();if(clean)router.push(`/analysis/${encodeURIComponent(clean)}`);} return <form onSubmit={submit} className="mx-auto mt-10 flex max-w-2xl border border-white/20 bg-white p-1.5 text-navy"><Search className="ml-3 self-center text-slate-400" size={20}/><input value={symbol} onChange={e=>setSymbol(e.target.value)} className="min-w-0 flex-1 px-3 py-3 font-mono text-sm outline-none" placeholder="Enter a ticker, e.g. FPT, VCB, HPG" aria-label="Stock symbol"/><button className="btn-primary shrink-0">Analyze <ArrowRight size={16}/></button></form>; }
