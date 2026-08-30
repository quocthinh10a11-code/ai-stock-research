import type { TrendForecast } from "@/types/stock";

const monthsByHorizon: Record<TrendForecast["horizon"], number> = { "1M": 1, "3M": 3, "6M": 6 };

function addUtcMonths(dateValue: string, months: number) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

export function buildPredictionRows(input: {
  symbol: string;
  asOf: string;
  entryPrice: number;
  evidenceSnapshotId: number;
  inputHash: string;
  forecasts: TrendForecast[];
}) {
  const predictionDate = input.asOf.slice(0, 10);
  return input.forecasts.map((forecast) => ({
    symbol: input.symbol,
    prediction_date: predictionDate,
    evidence_snapshot_id: input.evidenceSnapshotId,
    bias_at_prediction: forecast.direction,
    scenario_text: JSON.stringify({
      version: 1,
      horizon: forecast.horizon,
      bullishProbability: forecast.bullishProbability,
      neutralProbability: forecast.neutralProbability,
      bearishProbability: forecast.bearishProbability,
      rationale: forecast.rationale,
      entryPrice: input.entryPrice,
      inputHash: input.inputHash,
      reportAsOf: input.asOf,
    }),
    target_check_date: addUtcMonths(predictionDate, monthsByHorizon[forecast.horizon]),
    outcome_status: "pending",
  }));
}
