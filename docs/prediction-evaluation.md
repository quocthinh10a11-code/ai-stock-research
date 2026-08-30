# AI scenario evaluation

AI scenarios are observations to backtest, not price targets or promises. A newly synthesized cited report records one deduplicated prediction for each 1M, 3M, and 6M horizon only when a synchronized entry price and technical evidence snapshot exist.

Each record retains the symbol, report/input hash, entry price, evidence snapshot, direction, probability distribution, rationale, prediction date, and maturity date. Re-running research for the same symbol and day updates the same horizon records instead of creating duplicates.

The `Evaluate matured AI predictions` workflow runs at 19:07 ICT on weekdays, after the EOD market refresh. It compares the entry price with the first persisted EOD close on or after maturity:

- bullish is correct above +3%;
- bearish is correct below -3%;
- neutral is correct from -3% through +3%;
- other outcomes are incorrect; a scenario remains pending until an eligible close exists.

The evaluator uses a service-role-only Supabase function. Anonymous and authenticated clients retain read-only access through the existing `prediction_log` RLS policies and cannot execute the evaluator. The UI must continue to label probabilities as uncalibrated until the sample is large and representative enough for a separate calibration analysis.

Apply `supabase/migrations/20260830080000_add_prediction_evaluation.sql` before manually dispatching the evaluator for the first time.
