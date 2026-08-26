"use client";

import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck, LoaderCircle } from "lucide-react";
import { setWatchlistStatus } from "@/app/actions/watchlist";
import { cn } from "@/lib/utils";

export function WatchlistButton({ symbol, initiallySaved = false }: { symbol: string; initiallySaved?: boolean }) {
  const [saved, setSaved] = useState(initiallySaved);
  const [feedback, setFeedback] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle() {
    setFeedback("");
    startTransition(async () => {
      const result = await setWatchlistStatus(symbol, !saved);
      setFeedback(result.message);
      if (result.ok) setSaved(result.saved);
    });
  }

  return <div className="flex flex-col items-end gap-1"><button type="button" onClick={toggle} disabled={pending} aria-pressed={saved} className={cn("inline-flex min-w-20 items-center justify-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-60", saved ? "border-navy bg-navy text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-navy")}>
    {pending ? <LoaderCircle size={14} className="animate-spin"/> : saved ? <BookmarkCheck size={14}/> : <Bookmark size={14}/>} {saved ? "Saved" : "Add"}
  </button>{feedback && <span className={cn("max-w-40 text-right text-[10px] leading-4", feedback.includes("Could not") || feedback.includes("Sign in") ? "text-bear" : "text-slate-500")} role="status">{feedback}</span>}</div>;
}
