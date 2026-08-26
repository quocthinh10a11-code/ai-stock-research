import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { TopNavBar } from "@/components/ui/TopNavBar";

export default function AnalysisNotFound() {
  return <><TopNavBar variant="public"/><main className="grid min-h-screen place-items-center bg-canvas px-5 py-28"><section className="w-full max-w-xl border border-slate-200 bg-white p-8 text-center"><SearchX className="mx-auto text-slate-400" size={32}/><h1 className="mt-5 font-display text-2xl font-semibold">Stock ticker not found</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">This ticker is not available in the current research universe. Return to the market page and try FPT, VCB, HPG, MWG, or VNM.</p><Link href="/home" className="btn-primary mt-7"><ArrowLeft size={16}/>Back to market</Link></section></main></>;
}
