import { analysis } from "@/lib/mock-data";
export async function getAnalysis(symbol = "FPT") { return { ...analysis, symbol: symbol.toUpperCase() }; }
