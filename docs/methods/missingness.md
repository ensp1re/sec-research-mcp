# Missingness and numeric contracts

Missing, not applicable, source absent, parse failed, excluded by policy, and coverage incomplete are distinct. None of them becomes the number zero.

Reported financial values are decimal strings with an explicit unit. Counts stay integers only inside verified bounds.

A request for N periods returns the observed periods plus a coverage result. The product does not invent missing quarters.

Revision policies: `as_reported`, `latest_available`, `as_of` (requires a cutoff). Point-in-time reads must not silently use a current merged payload as history.

Q4 may be derived from annual minus nine-month cumulative only for additive duration metrics. EPS, percentages, weighted-average shares, and balance-sheet instants are never derived by subtraction.
